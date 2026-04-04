import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateMockUptimeChecks } from '@/lib/mock-data'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site_id')
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

  try {
    let query = supabase
      .from('ops_uptime_checks')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit)

    if (siteId) query = query.eq('site_id', siteId)

    const { data, error } = await query
    if (error) throw error
    if (data?.length) return NextResponse.json(data)
    return NextResponse.json(siteId ? generateMockUptimeChecks(siteId) : [], {
      headers: { 'X-Data-Source': 'mock' },
    })
  } catch {
    return NextResponse.json(siteId ? generateMockUptimeChecks(siteId) : [], {
      headers: { 'X-Data-Source': 'mock' },
    })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { data, error } = await supabase.from('ops_uptime_checks').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (!body.is_up) {
    await supabase.from('ops_alerts').insert({
      site_id: body.site_id,
      type: 'site_down',
      severity: 'critical',
      title: 'Site is down',
      message: `Site returned error: ${body.error || 'Connection failed'}`,
    })
  } else if (body.response_time_ms > 2000) {
    await supabase.from('ops_alerts').insert({
      site_id: body.site_id,
      type: 'site_slow',
      severity: 'warning',
      title: 'Site responding slowly',
      message: `Response time: ${body.response_time_ms}ms (threshold: 2000ms)`,
    })
  }

  return NextResponse.json(data)
}
