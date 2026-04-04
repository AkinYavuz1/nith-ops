import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => ({ ok: r.ok, status: r.status }))
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

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      playedToday,
      avgScoreToday: Math.round(avgScoreToday * 10) / 10,
      topStreaks: topStreaks ?? [],
      gameHealth: { active, deprioritized, retired },
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
