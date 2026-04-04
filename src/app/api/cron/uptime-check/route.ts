import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

// Called by an external cron service (e.g. cron-job.org, GitHub Actions, Cloudflare Workers Cron)
// Secure with: GET /api/cron/uptime-check?secret=YOUR_CRON_SECRET
// Set CRON_SECRET env var and configure your cron service to call this URL every 5 minutes.

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: sites } = await supabase
    .from('ops_sites')
    .select('id, url, name')
    .eq('status', 'active')

  if (!sites?.length) return NextResponse.json({ checked: 0 })

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
        await Promise.all([
          supabase.from('ops_alerts').insert({
            site_id: site.id, type: 'site_down', severity: 'critical',
            title: `${site.name} is down`, message: error || 'Site returned non-200 status',
          }),
          supabase.from('ops_activity').insert({
            site_id: site.id, type: 'alert', title: `${site.name} went down`,
            description: error || 'Detected by scheduled uptime check',
          }),
        ])
      } else if (responseTimeMs > 2000) {
        await supabase.from('ops_alerts').insert({
          site_id: site.id, type: 'site_slow', severity: 'warning',
          title: `${site.name} responding slowly`, message: `Response time: ${responseTimeMs}ms`,
        })
      }

      return { site: site.name, isUp, responseTimeMs }
    })
  )

  const checked = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ checked, results: results.map((r) => r.status === 'fulfilled' ? r.value : null) })
}
