import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase as opsDb } from '@/lib/supabase'

export const runtime = 'edge'

function getDDClient() {
  const url = process.env.DAILYDUEL_SUPABASE_URL
  const key = process.env.DAILYDUEL_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('DailyDuel Supabase env vars not set')
  return createClient(url, key)
}

export async function GET() {
  try {
    const db = getDDClient()
    const today = new Date().toISOString().split('T')[0]

    const [
      { count: totalUsers },
      { data: todayScores },
      { data: topStreaks },
      deployStatus,
    ] = await Promise.all([
      db.from('profiles').select('*', { count: 'exact', head: true }),
      db.from('scores').select('score').eq('game_date', today),
      db.from('profiles')
        .select('display_name, current_streak, best_streak, total_score')
        .order('current_streak', { ascending: false })
        .limit(5),
      fetch('https://daily-duel.akinlive.workers.dev', {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      })
        .then((r) => ({ ok: r.ok || r.status === 304, status: r.status }))
        .catch(() => ({ ok: false, status: 0 })),
    ])

    const { data: gameHealthRows } = await db.from('game_health').select('status')

    const playedToday = todayScores?.length ?? 0
    const avgScoreToday =
      playedToday > 0
        ? todayScores!.reduce((sum, r) => sum + r.score, 0) / playedToday
        : 0

    const active = gameHealthRows?.filter((g) => g.status === 'active').length ?? 0
    const deprioritized = gameHealthRows?.filter((g) => g.status === 'deprioritized').length ?? 0
    const retired = gameHealthRows?.filter((g) => g.status === 'retired').length ?? 0

    // Store today's player count + fetch history — wrapped so failures never break the main response
    let playerHistory: { date: string; unique_visitors: number }[] = []
    try {
      const { data: ddSite } = await opsDb
        .from('ops_sites')
        .select('id')
        .ilike('name', '%dailyduel%')
        .maybeSingle()

      if (ddSite?.id) {
        if (playedToday > 0) {
          await opsDb.from('ops_traffic').upsert(
            {
              site_id: ddSite.id,
              date: today,
              unique_visitors: playedToday,
              page_views: playedToday,
              bandwidth_bytes: 0,
              requests: playedToday,
              threats_blocked: 0,
              top_pages: [],
              top_countries: [],
            },
            { onConflict: 'site_id,date' }
          )
        }
        const { data: history } = await opsDb
          .from('ops_traffic')
          .select('date, unique_visitors')
          .eq('site_id', ddSite.id)
          .order('date', { ascending: true })
          .limit(30)
        playerHistory = history ?? []
      }
    } catch { /* history tracking is non-critical */ }

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      playedToday,
      avgScoreToday: Math.round(avgScoreToday * 10) / 10,
      topStreaks: topStreaks ?? [],
      gameHealth: { active, deprioritized, retired },
      playerHistory,
      deploy: {
        url: 'https://daily-duel.akinlive.workers.dev',
        up: deployStatus.ok,
        statusCode: deployStatus.status,
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
