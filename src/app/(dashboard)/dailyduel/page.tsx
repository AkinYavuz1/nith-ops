'use client'
export const runtime = 'edge'

import { useEffect, useState, useCallback } from 'react'
import { ExternalLink, RefreshCw, Flame, Trophy, Gamepad2, CheckCircle, XCircle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Card from '@/components/Card'

interface DailyDuelData {
  totalUsers: number
  playedToday: number
  avgScoreToday: number
  topStreaks: { display_name: string; current_streak: number; best_streak: number; total_score: number }[]
  gameHealth: { active: number; deprioritized: number; retired: number }
  playerHistory: { date: string; unique_visitors: number }[]
  deploy: { url: string; up: boolean; statusCode: number }
  fetchedAt: string
  error?: string
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-[#9BA1B0] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#E4E7EC]">{value}</p>
      {sub && <p className="text-xs text-[#9BA1B0] mt-0.5">{sub}</p>}
    </Card>
  )
}

export default function DailyDuelPage() {
  const [data, setData] = useState<DailyDuelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dailyduel', { signal: AbortSignal.timeout(12000) })
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const skeleton = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[#1A1D27] rounded-xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-[#1A1D27] rounded-xl animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#E4E7EC]">DailyDuel</h1>
          {lastUpdated && <p className="text-xs text-[#9BA1B0] mt-0.5">Updated {lastUpdated}</p>}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://daily-duel.akinyavuz.workers.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#3B82F6] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open app
          </a>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-[#252836] hover:bg-[#2E3241] text-[#9BA1B0] hover:text-[#E4E7EC] text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading && !data ? skeleton : data?.error ? (
        <Card className="p-8 text-center">
          <p className="text-[#EF4444] text-sm">Failed to load DailyDuel data.</p>
          <button onClick={fetchData} className="mt-3 text-xs text-[#9BA1B0] hover:text-[#E4E7EC]">Try again</button>
        </Card>
      ) : data ? (
        <>
          {/* Deploy status banner */}
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${
            data.deploy.up
              ? 'bg-[#0D2B1F] border-[#166534] text-[#4ADE80]'
              : 'bg-[#2B0D0D] border-[#991B1B] text-[#F87171]'
          }`}>
            {data.deploy.up
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <XCircle className="w-4 h-4 flex-shrink-0" />}
            <span className="font-medium">
              {data.deploy.up ? 'App is online' : 'App appears down'}
            </span>
            <span className="text-xs opacity-70 ml-auto">{data.deploy.url}</span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={data.totalUsers} />
            <StatCard label="Played Today" value={data.playedToday} sub="unique players" />
            <StatCard label="Avg Score Today" value={`${data.avgScoreToday}/10`} />
            <StatCard
              label="Game Library"
              value={data.gameHealth.active}
              sub={`${data.gameHealth.deprioritized} deprioritized · ${data.gameHealth.retired} retired`}
            />
          </div>

          {/* Player history chart */}
          {data.playerHistory.length > 1 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">Players Per Day (30 days)</h2>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data.playerHistory.map((d) => ({ date: d.date.slice(5), players: d.unique_visitors }))}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1D27', border: '1px solid #2E3241', borderRadius: '8px', color: '#E4E7EC', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="players" stroke="#D4A84B" fill="#D4A84B" fillOpacity={0.2} name="Players" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Bottom row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Streaks */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-[#F97316]" />
                <h2 className="text-sm font-semibold text-[#E4E7EC]">Top Streaks</h2>
              </div>
              {data.topStreaks.length === 0 ? (
                <p className="text-xs text-[#9BA1B0]">No players yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.topStreaks.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#2E3241] last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#9BA1B0] w-4">{i + 1}</span>
                        <span className="text-sm text-[#E4E7EC]">{p.display_name || 'Anonymous'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#9BA1B0]">
                        <span className="text-[#F97316] font-semibold">{p.current_streak} day{p.current_streak !== 1 ? 's' : ''}</span>
                        <span>best {p.best_streak}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Game Health */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Gamepad2 className="w-4 h-4 text-[#D4A84B]" />
                <h2 className="text-sm font-semibold text-[#E4E7EC]">Game Health</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Active', value: data.gameHealth.active, color: '#4ADE80', bg: 'bg-[#4ADE80]' },
                  { label: 'Deprioritized', value: data.gameHealth.deprioritized, color: '#F59E0B', bg: 'bg-[#F59E0B]' },
                  { label: 'Retired', value: data.gameHealth.retired, color: '#6B7280', bg: 'bg-[#6B7280]' },
                ].map(({ label, value, color, bg }) => {
                  const total = data.gameHealth.active + data.gameHealth.deprioritized + data.gameHealth.retired
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color }}>{label}</span>
                        <span className="text-[#9BA1B0]">{value} games ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-[#2E3241] rounded-full overflow-hidden">
                        <div className={`h-full ${bg} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-[#2E3241]">
                <div className="flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-[#D4A84B]" />
                  <span className="text-xs text-[#9BA1B0]">
                    Total games in library: {data.gameHealth.active + data.gameHealth.deprioritized + data.gameHealth.retired}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
