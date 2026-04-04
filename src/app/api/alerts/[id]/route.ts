import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = { ...body }
  if (body.acknowledged) update.acknowledged_at = new Date().toISOString()
  if (body.resolved) update.resolved_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('ops_alerts')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
