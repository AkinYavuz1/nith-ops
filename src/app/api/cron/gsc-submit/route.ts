import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

// Monthly sitemap re-submission for all active sites.
// Called by cron-worker on the 1st of each month at 10:00 UTC.
// GET /api/cron/gsc-submit?secret=YOUR_CRON_SECRET
//
// Per site:
//   - Submits /sitemap.xml to GSC
//   - Fetches back sitemap status (submitted count, indexed count)
//   - Logs result to ops_activity
//   - Creates warning alert if site not verified in GSC

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GSC_CLIENT_ID!,
      client_secret: process.env.GSC_CLIENT_SECRET!,
      refresh_token: process.env.GSC_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error?: string }
  if (!res.ok || !data.access_token) throw new Error(`GSC token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
}

function normalise(url: string) { return url.endsWith('/') ? url : url + '/' }

interface SitemapStatus {
  contents?: Array<{ type?: string; submitted?: number; indexed?: number }>
  errors?: Array<{ message?: string }>
  isPending?: boolean
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GSC_CLIENT_ID || !process.env.GSC_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'GSC credentials not configured' }, { status: 500 })
  }

  const { data: sites } = await supabase
    .from('ops_sites')
    .select('id, name, url')
    .eq('status', 'active')
    .like('url', 'http%')

  if (!sites?.length) return NextResponse.json({ submitted: 0 })

  let token: string
  try {
    token = await getAccessToken()
  } catch (err) {
    return NextResponse.json({ error: `Token refresh failed: ${err instanceof Error ? err.message : err}` }, { status: 500 })
  }

  const results: Array<{
    site: string
    sitemapSubmitted: boolean
    sitemapHttpStatus: number
    submitted?: number
    indexed?: number
    error?: string
  }> = []

  for (const site of sites) {
    const norm = normalise(site.url)
    const sitemapUrl = norm + 'sitemap.xml'

    // Submit sitemap (PUT is idempotent)
    const sitemapRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(norm)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
      { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
    )

    const ok = sitemapRes.ok
    let submitted: number | undefined
    let indexed: number | undefined

    // Fetch status to get counts
    if (ok) {
      const statusRes = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(norm)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (statusRes.ok) {
        const status = await statusRes.json() as SitemapStatus
        const webContent = status.contents?.find(c => c.type === 'web')
        submitted = webContent?.submitted
        indexed = webContent?.indexed
      }
    }

    // Log to activity
    await supabase.from('ops_activity').insert({
      site_id: site.id,
      type: 'update',
      title: ok ? `GSC sitemap refreshed — ${site.name}` : `GSC sitemap refresh failed — ${site.name}`,
      description: ok
        ? `${sitemapUrl} · ${submitted ?? '?'} submitted, ${indexed ?? '?'} indexed`
        : `HTTP ${sitemapRes.status} — site may need verification at search.google.com/search-console`,
    })

    // Alert if not verified
    if (!ok && sitemapRes.status === 403) {
      const { data: existingAlert } = await supabase
        .from('ops_alerts')
        .select('id')
        .eq('site_id', site.id)
        .eq('type', 'error_detected')
        .eq('resolved', false)
        .like('title', '%GSC verification%')
        .maybeSingle()

      if (!existingAlert) {
        await supabase.from('ops_alerts').insert({
          site_id: site.id,
          type: 'error_detected',
          severity: 'warning',
          title: `GSC verification required: ${site.name}`,
          message: `Sitemap submission rejected (403). Verify ownership: https://search.google.com/search-console/welcome?url=${encodeURIComponent(norm)}`,
        })
      }
    }

    results.push({
      site: site.name,
      sitemapSubmitted: ok,
      sitemapHttpStatus: sitemapRes.status,
      submitted,
      indexed,
    })
  }

  const succeeded = results.filter(r => r.sitemapSubmitted).length
  const failed = results.filter(r => !r.sitemapSubmitted).length

  return NextResponse.json({ submitted: succeeded, failed, total: sites.length, results })
}
