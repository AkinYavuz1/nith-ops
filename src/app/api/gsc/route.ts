import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

// GSC sitemap submission + status for a single site.
// POST /api/gsc  body: { site_id: string }   — submit sitemap
// GET  /api/gsc?site_id=xxx                  — fetch sitemap status

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

function normalise(url: string): string {
  return url.endsWith('/') ? url : url + '/'
}

interface SitemapStatus {
  path?: string
  lastSubmitted?: string
  isPending?: boolean
  contents?: Array<{ type?: string; submitted?: number; indexed?: number }>
  errors?: Array<{ message?: string }>
}

async function fetchSitemapStatus(token: string, siteUrl: string, sitemapUrl: string): Promise<SitemapStatus | null> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return null
  return await res.json() as SitemapStatus
}

// GET — fetch current sitemap status for a site
export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site_id')
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 })

  const { data: site, error } = await supabase
    .from('ops_sites')
    .select('id, name, url')
    .eq('id', siteId)
    .single()

  if (error || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  try {
    const token = await getAccessToken()
    const norm = normalise(site.url)
    const sitemapUrl = norm + 'sitemap.xml'
    const status = await fetchSitemapStatus(token, norm, sitemapUrl)
    return NextResponse.json({ site: site.name, siteUrl: norm, sitemapUrl, status })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST — add property + submit sitemap for a site
export async function POST(request: NextRequest) {
  const body = await request.json() as { site_id?: string }
  if (!body.site_id) return NextResponse.json({ error: 'site_id required' }, { status: 400 })

  const { data: site, error } = await supabase
    .from('ops_sites')
    .select('id, name, url')
    .eq('id', body.site_id)
    .single()

  if (error || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  if (!site.url.startsWith('http')) return NextResponse.json({ error: 'Site URL must be a valid http/https URL' }, { status: 400 })

  const norm = normalise(site.url)
  const sitemapUrl = norm + 'sitemap.xml'

  try {
    const token = await getAccessToken()

    // 1. Add property (PUT is idempotent in GSC)
    const addRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(norm)}`,
      { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
    )
    const propertyAdded = addRes.ok || addRes.status === 409

    // 2. Submit sitemap
    const sitemapRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(norm)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
      { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
    )
    const sitemapSubmitted = sitemapRes.ok

    // 3. Fetch status back
    const status = sitemapSubmitted ? await fetchSitemapStatus(token, norm, sitemapUrl) : null

    // 4. Log to activity
    const activityTitle = sitemapSubmitted
      ? `GSC sitemap submitted — ${site.name}`
      : `GSC setup attempted — ${site.name} (verification required)`
    const activityDesc = sitemapSubmitted
      ? `Sitemap ${sitemapUrl} submitted to Google Search Console`
      : `Property added (HTTP ${addRes.status}), sitemap submission failed (HTTP ${sitemapRes.status}) — site may need manual verification`

    await supabase.from('ops_activity').insert({
      site_id: body.site_id,
      type: 'update',
      title: activityTitle,
      description: activityDesc,
    })

    // 5. If not verified, log a warning alert
    if (!sitemapSubmitted) {
      await supabase.from('ops_alerts').insert({
        site_id: body.site_id,
        type: 'error_detected',
        severity: 'warning',
        title: `GSC verification required: ${site.name}`,
        message: `Site not yet verified in Google Search Console. Visit: https://search.google.com/search-console/welcome?url=${encodeURIComponent(norm)}`,
      })
    }

    return NextResponse.json({
      site: site.name,
      siteUrl: norm,
      sitemapUrl,
      propertyAdded,
      sitemapSubmitted,
      propertyHttpStatus: addRes.status,
      sitemapHttpStatus: sitemapRes.status,
      status,
      gscConsoleUrl: `https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(norm)}`,
      message: sitemapSubmitted
        ? 'Sitemap submitted. Google will begin crawling within 24–48h.'
        : 'Property created but verification required before sitemap is accepted. Check the GSC URL in the alert.',
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
