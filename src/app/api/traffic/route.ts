import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

const CF_API_TOKEN = process.env.CLOUDFLARE_ANALYTICS_TOKEN || process.env.CLOUDFLARE_API_TOKEN
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
// The original API token is needed for RUM site list (requires Account-level access)
const CF_MAIN_TOKEN = process.env.CLOUDFLARE_API_TOKEN

interface RUMSite {
  site_tag: string
  ruleset?: { zone_tag: string; zone_name: string }
}

interface TrafficDay {
  date: string
  unique_visitors: number
  page_views: number
}

// Cache RUM site list for the lifetime of the edge function instance
let rumSitesCache: RUMSite[] | null = null

async function getRUMSites(): Promise<RUMSite[]> {
  if (rumSitesCache) return rumSitesCache

  const token = CF_API_TOKEN || CF_MAIN_TOKEN
  if (!token || !CF_ACCOUNT_ID) return []

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/rum/site_info/list`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const json = await res.json()
  rumSitesCache = json?.result || []
  return rumSitesCache!
}

async function fetchRUMTraffic(siteTag: string, days = 30): Promise<TrafficDay[]> {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) return []

  const now = new Date()
  const since = new Date(now)
  since.setDate(since.getDate() - days)

  const query = `query {
    viewer {
      accounts(filter: { accountTag: "${CF_ACCOUNT_ID}" }) {
        rumPageloadEventsAdaptiveGroups(
          filter: {
            AND: [
              { datetime_geq: "${since.toISOString()}" }
              { datetime_leq: "${now.toISOString()}" }
              { siteTag: "${siteTag}" }
            ]
          }
          limit: ${days}
          orderBy: [date_ASC]
        ) {
          count
          dimensions { date }
          sum { visits }
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
  const groups = json?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups
  if (!groups?.length) return []

  return groups.map((g: { count: number; dimensions: { date: string }; sum: { visits: number } }) => ({
    date: g.dimensions.date,
    unique_visitors: g.sum.visits,
    page_views: g.count,
  }))
}

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site_id')

  try {
    // 1. Check Supabase for cached traffic data
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

    // 2. Try Cloudflare Web Analytics (RUM) — real human visitors only
    if (siteId && CF_API_TOKEN) {
      const { data: site } = await supabase
        .from('ops_sites')
        .select('cloudflare_zone_id, url')
        .eq('id', siteId)
        .single()

      if (site?.cloudflare_zone_id) {
        // Find the RUM site tag that matches this zone
        const rumSites = await getRUMSites()
        const rumSite = rumSites.find(
          (rs) => rs.ruleset?.zone_tag === site.cloudflare_zone_id
        )

        if (rumSite) {
          const rumData = await fetchRUMTraffic(rumSite.site_tag)

          if (rumData.length) {
            const trafficData = rumData.map((d) => ({
              id: `rum-${siteId}-${d.date}`,
              site_id: siteId,
              date: d.date,
              unique_visitors: d.unique_visitors,
              page_views: d.page_views,
              bandwidth_bytes: 0,
              requests: 0,
              threats_blocked: 0,
              top_pages: [],
              top_countries: [],
            }))

            // Cache in Supabase (fire-and-forget)
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
    }

    // 3. No data available
    return NextResponse.json([], {
      headers: { 'X-Data-Source': 'none' },
    })
  } catch {
    return NextResponse.json([], {
      headers: { 'X-Data-Source': 'none' },
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
