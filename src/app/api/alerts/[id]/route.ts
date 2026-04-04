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
    .select('*, site:ops_sites(name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-log activity when alert is resolved
  if (body.resolved) {
    await supabase.from('ops_activity').insert({
      site_id: data.site_id,
      type: 'alert',
      title: `Alert resolved — ${data.title}`,
      description: data.message,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabase.from('ops_alerts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
