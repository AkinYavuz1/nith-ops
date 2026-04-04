import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateMockTraffic } from '@/lib/mock-data'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site_id')

  try {
    let query = supabase
      .from('ops_traffic')
      .select('*')
      .order('date', { ascending: false })
      .limit(30)

    if (siteId) query = query.eq('site_id', siteId)

    const { data, error } = await query
    if (error) throw error
    if (data?.length) return NextResponse.json(data)
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
