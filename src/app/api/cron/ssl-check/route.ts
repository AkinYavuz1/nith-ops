import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

// Checks SSL certificate expiry for all active HTTPS sites.
// Call daily: GET /api/cron/ssl-check?secret=YOUR_CRON_SECRET
// Fires critical alert + email at ≤7 days, warning alert + email at ≤30 days.

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Nith Ops <alerts@nithdigital.uk>', to, subject, html }),
  })
}

async function getSslExpiryDays(url: string): Promise<number | null> {
  // Use Cloudflare's SSL Labs API to check cert expiry without a native TLS socket
  // (edge runtime doesn't support Node's tls module)
  try {
    const hostname = new URL(url).hostname
    const res = await fetch(
      `https://certlogik.com/decoder/?domain=${hostname}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json() as { valid_to?: string }
    if (!data.valid_to) return null
    const expiry = new Date(data.valid_to)
    const now = new Date()
    return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
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
    .like('url', 'https://%')

  if (!sites?.length) return NextResponse.json({ checked: 0 })

  // Avoid re-alerting: fetch existing unresolved ssl_expiring alerts
  const { data: existingSslAlerts } = await supabase
    .from('ops_alerts')
    .select('site_id')
    .eq('type', 'ssl_expiring')
    .eq('resolved', false)

  const alreadyAlertedIds = new Set((existingSslAlerts ?? []).map((a: { site_id: string }) => a.site_id))

  const results: Array<{ site: string; daysRemaining: number | null; alerted: boolean }> = []

  for (const site of sites) {
    const daysRemaining = await getSslExpiryDays(site.url)
    let alerted = false

    if (daysRemaining !== null && daysRemaining <= 30 && !alreadyAlertedIds.has(site.id)) {
      const isCritical = daysRemaining <= 7
      const severity = isCritical ? 'critical' : 'warning'
      const urgency = isCritical ? `EXPIRES IN ${daysRemaining} DAY${daysRemaining === 1 ? '' : 'S'}` : `expires in ${daysRemaining} days`

      await Promise.all([
        supabase.from('ops_alerts').insert({
          site_id: site.id,
          type: 'ssl_expiring',
          severity,
          title: `SSL certificate expiring: ${site.name}`,
          message: `Certificate ${urgency}. Renew immediately to avoid browser warnings.`,
        }),
        supabase.from('ops_activity').insert({
          site_id: site.id,
          type: 'alert',
          title: `SSL expiry alert: ${site.name}`,
          description: `Certificate ${urgency}`,
        }),
      ])

      const emoji = isCritical ? '🔴' : '🟡'
      await sendEmail(
        alertEmail,
        `${emoji} SSL expiring soon: ${site.name} (${daysRemaining}d)`,
        `<h2 style="color:${isCritical ? '#dc2626' : '#d97706'}">${emoji} SSL certificate expiring: ${site.name}</h2>
<p><strong>URL:</strong> <a href="${site.url}">${site.url}</a></p>
<p><strong>Days remaining:</strong> <strong style="color:${isCritical ? '#dc2626' : '#d97706'}">${daysRemaining}</strong></p>
<p>${isCritical
  ? '⚠️ <strong>Action required immediately.</strong> Visitors will see a browser security warning if not renewed.'
  : 'Renew within the next few weeks to avoid service disruption.'}</p>
<p style="margin-top:24px">
  <a href="https://nith-ops.pages.dev/alerts" style="background:#1e293b;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
    View in Nith Ops →
  </a>
</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px">Nith Ops SSL monitor · <a href="https://nith-ops.pages.dev">nith-ops.pages.dev</a></p>`
      )
      alerted = true
    }

    results.push({ site: site.name, daysRemaining, alerted })
  }

  return NextResponse.json({ checked: sites.length, results })
}
