import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: site } = await supabase.from('ops_sites').select('url').eq('id', id).single()

  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const start = Date.now()
  let isUp = false
  let statusCode: number | undefined
  let error: string | undefined

  try {
    const res = await fetch(site.url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    })
    statusCode = res.status
    isUp = res.ok || res.status < 400
  } catch (err) {
    error = err instanceof Error ? err.message : 'Connection failed'
    isUp = false
  }

  const responseTimeMs = Date.now() - start

  const checkData = {
    site_id: id,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    is_up: isUp,
    error,
    checked_at: new Date().toISOString(),
  }

  await supabase.from('ops_uptime_checks').insert(checkData)

  if (!isUp) {
    await supabase.from('ops_alerts').insert({
      site_id: id,
      type: 'site_down',
      severity: 'critical',
      title: `${site.url} is down`,
      message: error || 'Site returned non-200 status',
    })
  } else if (responseTimeMs > 2000) {
    await supabase.from('ops_alerts').insert({
      site_id: id,
      type: 'site_slow',
      severity: 'warning',
      title: 'Site responding slowly',
      message: `Response time: ${responseTimeMs}ms`,
    })
  }

  return NextResponse.json(checkData)
}
