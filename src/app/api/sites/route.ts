import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mockSites } from '@/lib/mock-data'

export const runtime = 'edge'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ops_sites')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(data?.length ? data : mockSites)
  } catch {
    return NextResponse.json(mockSites)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { data, error } = await supabase.from('ops_sites').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
