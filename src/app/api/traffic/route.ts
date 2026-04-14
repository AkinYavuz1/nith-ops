import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateMockTraffic } from '@/lib/mock-data'

export const runtime = 'edge'

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID

interface CFZoneAnalytics {
  date: string
  unique_visitors: number
  page_views: number
  requests: number
  bandwidth: number
  threats: number
}

async function fetchCloudflareZoneTraffic(zoneId: string, days = 30): Promise<CFZoneAnalytics[]> {
  if (!CF_API_TOKEN) return []

  const now = new Date()
  const since = new Date(now)
  since.setDate(since.getDate() - days)

  const query = `query {
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequests1dGroups(
          limit: ${days}
          filter: { date_geq: "${since.toISOString().split('T')[0]}", date_leq: "${now.toISOString().split('T')[0]}" }
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum { requests bytes threats }
          uniq { uniques }
        }
      }
    }
  }`

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) return []

  const json = await res.json()
  const groups = json?.data?.viewer?.zones?.[0]?.httpRequests1dGroups
  if (!groups?.length) return []

  return groups.map((g: { dimensions: { date: string }; sum: { requests: number; bytes: number; threats: number }; uniq: { uniques: number } }) => ({
    date: g.dimensions.date,
    unique_visitors: g.uniq.uniques,
    page_views: g.sum.requests, // CF doesn't distinguish page views from requests at zone level
    requests: g.sum.requests,
    bandwidth: g.sum.bytes,
    threats: g.sum.threats,
  }))
}

async function fetchCloudflareAccountTraffic(domain: string, days = 30): Promise<CFZoneAnalytics[]> {
  // For sites without a zone ID, try account-level analytics by looking up the zone
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) return []

  // First, look up zone ID by domain name
  const zoneRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&account.id=${CF_ACCOUNT_ID}`,
    {
      headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
    }
  )
  if (!zoneRes.ok) return []
  const zoneJson = await zoneRes.json()
  const zoneId = zoneJson?.result?.[0]?.id
  if (!zoneId) return []

  return fetchCloudflareZoneTraffic(zoneId, days)
}

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site_id')

  try {
    // 1. Check Supabase for stored traffic data
    let query = supabase
      .from('ops_traffic')
      .select('*')
      .order('date', { ascending: false })
      .limit(30)

    if (siteId) query = query.eq('site_id', siteId)

    const { data, error } = await query
    if (!error && data?.length) {
      return NextResponse.json(data, {
        headers: { 'X-Data-Source': 'supabase' },
      })
    }

    // 2. If we have a site ID, try to fetch from Cloudflare
    if (siteId && CF_API_TOKEN) {
      // Get the site to find its zone ID or domain
      const { data: site } = await supabase
        .from('ops_sites')
        .select('cloudflare_zone_id, url')
        .eq('id', siteId)
        .single()

      if (site) {
        let cfData: CFZoneAnalytics[] = []

        if (site.cloudflare_zone_id) {
          cfData = await fetchCloudflareZoneTraffic(site.cloudflare_zone_id)
        } else {
          // Try to auto-discover zone by domain
          try {
            const url = new URL(site.url)
            // Only try for non-github, non-vercel domains (actual CF-managed zones)
            if (!url.hostname.includes('github.com') && !url.hostname.includes('vercel.app')) {
              cfData = await fetchCloudflareAccountTraffic(url.hostname, 30)
            }
          } catch { /* invalid URL, skip */ }
        }

        if (cfData.length) {
          // Transform and return CF data
          const trafficData = cfData.map((d) => ({
            id: `cf-${siteId}-${d.date}`,
            site_id: siteId,
            date: d.date,
            unique_visitors: d.unique_visitors,
            page_views: d.page_views,
            bandwidth_bytes: d.bandwidth,
            requests: d.requests,
            threats_blocked: d.threats,
            top_pages: [],
            top_countries: [],
          }))

          // Store in Supabase for caching (fire-and-forget)
          supabase
            .from('ops_traffic')
            .upsert(
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              trafficData.map(({ id, ...rest }) => rest),
              { onConflict: 'site_id,date' }
            )
            .then(() => {})

          return NextResponse.json(trafficData, {
            headers: { 'X-Data-Source': 'cloudflare' },
          })
        }
      }
    }

    // 3. Fall back to mock data
    return NextResponse.json(siteId ? generateMockTraffic(siteId) : [], {
      headers: { 'X-Data-Source': 'mock' },
    })
  } catch {
    return NextResponse.json(siteId ? generateMockTraffic(siteId) : [], {
      headers: { 'X-Data-Source': 'mock' },
    })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { data, error } = await supabase
    .from('ops_traffic')
    .upsert(body, { onConflict: 'site_id,date' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
