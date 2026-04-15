import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

// Called by cron-worker every hour.
// Secure with: GET /api/cron/uptime-check?secret=YOUR_CRON_SECRET

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Nith Ops <alerts@nithdigital.uk>',
      to,
      subject,
      html,
    }),
  })
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const alertEmail = process.env.ALERT_EMAIL || 'akin@nithdigital.uk'

  const { data: sites } = await supabase
    .from('ops_sites')
    .select('id, url, name')
    .eq('status', 'active')

  if (!sites?.length) return NextResponse.json({ checked: 0 })

  // Fetch existing unresolved site_down alerts so we don't spam on every hourly check
  const { data: existingDownAlerts } = await supabase
    .from('ops_alerts')
    .select('site_id')
    .eq('type', 'site_down')
    .eq('resolved', false)

  const alreadyDownSiteIds = new Set((existingDownAlerts ?? []).map((a: { site_id: string }) => a.site_id))

  const results = await Promise.allSettled(
    sites.map(async (site) => {
      const start = Date.now()
      let isUp = false
      let statusCode: number | undefined
      let error: string | undefined

      try {
        const res = await fetch(site.url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
        statusCode = res.status
        isUp = res.ok || res.status < 400
      } catch (err) {
        error = err instanceof Error ? err.message : 'Connection failed'
      }

      const responseTimeMs = Date.now() - start

      await supabase.from('ops_uptime_checks').insert({
        site_id: site.id, status_code: statusCode, response_time_ms: responseTimeMs, is_up: isUp, error,
      })

      if (!isUp) {
        const errorMsg = error || `HTTP ${statusCode}`
        await Promise.all([
          supabase.from('ops_alerts').insert({
            site_id: site.id, type: 'site_down', severity: 'critical',
            title: `${site.name} is down`, message: errorMsg,
          }),
          supabase.from('ops_activity').insert({
            site_id: site.id, type: 'alert', title: `${site.name} went down`,
            description: errorMsg,
          }),
        ])

        // Only email if this site wasn't already flagged as down (avoids hourly spam)
        if (!alreadyDownSiteIds.has(site.id)) {
          await sendEmail(
            alertEmail,
            `🔴 Site down: ${site.name}`,
            `<h2 style="color:#dc2626">🔴 ${site.name} is down</h2>
<p><strong>URL:</strong> <a href="${site.url}">${site.url}</a></p>
<p><strong>Error:</strong> ${errorMsg}</p>
<p><strong>Detected at:</strong> ${new Date().toUTCString()}</p>
<p style="margin-top:24px">
  <a href="https://nith-ops.pages.dev/alerts" style="background:#1e293b;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
    View in Nith Ops →
  </a>
</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px">Nith Ops automated alert · <a href="https://nith-ops.pages.dev">nith-ops.pages.dev</a></p>`
          )
        }
      } else if (responseTimeMs > 2000) {
        await supabase.from('ops_alerts').insert({
          site_id: site.id, type: 'site_slow', severity: 'warning',
          title: `${site.name} responding slowly`, message: `Response time: ${responseTimeMs}ms`,
        })
        // Only email if response is very slow (>5s) to avoid noise
        if (responseTimeMs > 5000) {
          await sendEmail(
            alertEmail,
            `🟡 Site slow: ${site.name} (${responseTimeMs}ms)`,
            `<h2 style="color:#d97706">🟡 ${site.name} is responding slowly</h2>
<p><strong>URL:</strong> <a href="${site.url}">${site.url}</a></p>
<p><strong>Response time:</strong> ${responseTimeMs}ms (threshold: 5000ms)</p>
<p><strong>Detected at:</strong> ${new Date().toUTCString()}</p>
<p style="margin-top:24px">
  <a href="https://nith-ops.pages.dev/alerts" style="background:#1e293b;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
    View in Nith Ops →
  </a>
</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px">Nith Ops automated alert · <a href="https://nith-ops.pages.dev">nith-ops.pages.dev</a></p>`
          )
        }
      }

      return { site: site.name, isUp, responseTimeMs }
    })
  )

  const checked = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ checked, results: results.map((r) => r.status === 'fulfilled' ? r.value : null) })
}
