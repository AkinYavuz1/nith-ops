import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site_id')
  const month = request.nextUrl.searchParams.get('month')

  let query = supabase
    .from('ops_invoices')
    .select('*, site:ops_sites(name, client_name, monthly_fee)')
    .order('created_at', { ascending: false })

  if (siteId) query = query.eq('site_id', siteId)
  if (month) query = query.eq('month', month)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { data, error } = await supabase
    .from('ops_invoices')
    .insert(body)
    .select('*, site:ops_sites(name, client_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const siteName = data.site?.client_name || data.site?.name || 'Unknown client'
  await supabase.from('ops_activity').insert({
    site_id: body.site_id,
    type: 'invoice',
    title: `Invoice generated — ${siteName}`,
    description: `£${body.amount} · ${body.month}`,
  })

  return NextResponse.json(data)
}
