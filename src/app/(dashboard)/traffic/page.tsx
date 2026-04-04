'use client'
export const runtime = 'edge'


import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Site } from '@/lib/types'
import Card from '@/components/Card'
import ConnectCard from '@/components/ConnectCard'

interface TrafficEntry {
  date: string
  unique_visitors: number
  page_views: number
}

interface SiteTraffic extends Site {
  traffic: TrafficEntry[]
  totalVisitors: number
  totalThisWeek: number
  totalToday: number
}

export default function TrafficPage() {
  const [sitesWithTraffic, setSitesWithTraffic] = useState<SiteTraffic[]>([])
  const [chartData, setChartData] = useState<Array<Record<string, string | number>>>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<string | null>(null)
  const cfConfigured = false // Will be true when token is set

  const fetchData = useCallback(async () => {
    try {
      const sitesRes = await fetch('/api/sites', { signal: AbortSignal.timeout(10000) })
      const sites: Site[] = sitesRes.ok ? await sitesRes.json() : []

      const trafficPromises = sites.map((s) =>
        fetch(`/api/traffic?site_id=${s.id}`, { signal: AbortSignal.timeout(10000) })
          .then((r) => r.ok ? r.json() : [])
          .catch(() => [])
      )
      const trafficResults = await Promise.all(trafficPromises)

      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const withTraffic: SiteTraffic[] = sites.map((s, i) => {
        const traffic: TrafficEntry[] = trafficResults[i] || []
        return {
          ...s,
          traffic: traffic.reverse(),
          totalVisitors: traffic.reduce((sum, t) => sum + t.unique_visitors, 0),
          totalThisWeek: traffic.filter((t) => t.date >= weekAgo).reduce((sum, t) => sum + t.unique_visitors, 0),
          totalToday: traffic.find((t) => t.date === today)?.unique_visitors || 0,
        }
      })

      setSitesWithTraffic(withTraffic)

      // Build aggregate chart data
      const dateMap = new Map<string, Record<string, number>>()
      withTraffic.forEach((s) => {
        s.traffic.forEach((t) => {
          if (!dateMap.has(t.date)) dateMap.set(t.date, {})
          dateMap.get(t.date)![s.name] = t.unique_visitors
        })
      })
      const combined = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, vals]) => ({ date: date.slice(5), ...vals }))
      setChartData(combined)
    } catch {
      setSitesWithTraffic([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const colors = ['#3B82F6', '#22C55E', '#D4A84B', '#F59E0B', '#8B5CF6', '#EC4899']
  const selected = selectedSite ? sitesWithTraffic.find((s) => s.id === selectedSite) : null
  const tooltipStyle = {
    backgroundColor: '#1A1D27',
    border: '1px solid #2E3241',
    borderRadius: '8px',
    color: '#E4E7EC',
    fontSize: '12px',
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#E4E7EC]">Traffic Analytics</h1>
      </div>

      {!cfConfigured && (
        <ConnectCard
          service="Cloudflare"
          description="Connect Cloudflare to see real traffic data. Currently showing mock data."
          steps={[
            { text: 'Go to Cloudflare dashboard → My Profile → API Tokens' },
            { text: 'Create a token with "Zone Analytics" read permission for all zones' },
            { text: 'Add to .env.local:', code: 'CLOUDFLARE_API_TOKEN=your_token' },
            { text: 'Add your account ID:', code: 'CLOUDFLARE_ACCOUNT_ID=your_id' },
            { text: 'Add each site\'s zone ID in site settings' },
          ]}
        />
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-[#1A1D27] rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Aggregate totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Total Visitors (30d)</p>
              <p className="text-2xl font-bold text-[#E4E7EC]">
                {sitesWithTraffic.reduce((sum, s) => sum + s.totalVisitors, 0).toLocaleString()}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">This Week</p>
              <p className="text-2xl font-bold text-[#E4E7EC]">
                {sitesWithTraffic.reduce((sum, s) => sum + s.totalThisWeek, 0).toLocaleString()}
              </p>
            </Card>
            <Card className="p-4 col-span-2 md:col-span-1">
              <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Today</p>
              <p className="text-2xl font-bold text-[#E4E7EC]">
                {sitesWithTraffic.reduce((sum, s) => sum + s.totalToday, 0).toLocaleString()}
              </p>
            </Card>
          </div>

          {/* Aggregate chart */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">
              Daily Visitors by Site (30 days)
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#9BA1B0' }} />
                {sitesWithTraffic.slice(0, 6).map((s, i) => (
                  <Bar key={s.id} dataKey={s.name} stackId="a" fill={colors[i % colors.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Site table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2E3241]">
                    <th className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Site</th>
                    <th className="text-right text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Today</th>
                    <th className="text-right text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">This Week</th>
                    <th className="text-right text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">30 Days</th>
                    <th className="text-right text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {sitesWithTraffic.map((s) => {
                    const isUp = s.totalThisWeek >= (s.traffic.slice(7, 14).reduce((sum, t) => sum + t.unique_visitors, 0))
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-[#2E3241] last:border-0 hover:bg-[#252836] cursor-pointer"
                        onClick={() => setSelectedSite(selectedSite === s.id ? null : s.id)}
                      >
                        <td className="px-4 py-3 font-medium text-[#E4E7EC]">{s.name}</td>
                        <td className="px-4 py-3 text-right text-[#9BA1B0]">{s.totalToday.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-[#9BA1B0]">{s.totalThisWeek.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-[#9BA1B0]">{s.totalVisitors.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {isUp
                            ? <TrendingUp className="w-4 h-4 text-[#22C55E] ml-auto" />
                            : <TrendingDown className="w-4 h-4 text-[#EF4444] ml-auto" />
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Per-site drill-down */}
          {selected && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">
                {selected.name} — Daily Visitors
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={selected.traffic}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="unique_visitors" fill="#3B82F6" name="Visitors" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
