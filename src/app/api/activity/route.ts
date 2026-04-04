import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site_id')
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

  try {
    let query = supabase
      .from('ops_activity')
      .select('*, site:ops_sites(name)')
      .order('created_at', { ascending: false })
      .limit(limit)

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
  const { data, error } = await supabase.from('ops_activity').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
