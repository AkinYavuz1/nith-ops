import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const resolved = request.nextUrl.searchParams.get('resolved')
  const siteId = request.nextUrl.searchParams.get('site_id')

  try {
    let query = supabase
      .from('ops_alerts')
      .select('*, site:ops_sites(name, url)')
      .order('created_at', { ascending: false })

    if (resolved !== null) query = query.eq('resolved', resolved === 'true')
    if (siteId) query = query.eq('site_id', siteId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { data, error } = await supabase.from('ops_alerts').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
