'use client'
export const runtime = 'edge'


import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle } from 'lucide-react'
import { Site, UptimeCheck } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import Card from '@/components/Card'
import { typeBadge } from '@/components/Badge'
import Link from 'next/link'

interface SiteWithUptime extends Site {
  checks: UptimeCheck[]
  currentStatus?: boolean
  avgResponseTime?: number
}

export default function UptimePage() {
  const [sites, setSites] = useState<SiteWithUptime[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const sitesRes = await fetch('/api/sites', { signal: AbortSignal.timeout(10000) })
      const sitesData: Site[] = sitesRes.ok ? await sitesRes.json() : []

      const checkPromises = sitesData.map((s) =>
        fetch(`/api/uptime?site_id=${s.id}&limit=30`, { signal: AbortSignal.timeout(10000) })
          .then((r) => r.ok ? r.json() : [])
          .catch(() => [])
      )
      const checksData = await Promise.all(checkPromises)

      setSites(
        sitesData.map((s, i) => {
          const checks: UptimeCheck[] = checksData[i] || []
          const upChecks = checks.filter((c) => c.is_up)
          const avgMs = upChecks.length
            ? Math.round(upChecks.reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / upChecks.length)
            : undefined
          return {
            ...s,
            checks,
            currentStatus: checks[0]?.is_up,
            avgResponseTime: avgMs,
          }
        })
      )
    } catch {
      setSites([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function checkAllSites() {
    setChecking(true)
    const sitesRes = await fetch('/api/sites')
    const sitesData: Site[] = await sitesRes.json()
    await Promise.all(
      sitesData
        .filter((s) => s.status === 'active')
        .map((s) => fetch(`/api/sites/${s.id}/check`, { method: 'POST' }))
    )
    setLastChecked(new Date())
    await fetchData()
    setChecking(false)
  }

  // Build last 30 days date array
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })

  function getDateStatus(checks: UptimeCheck[], date: string): 'up' | 'down' | 'no-data' {
    const dayChecks = checks.filter((c) => c.checked_at.startsWith(date))
    if (dayChecks.length === 0) return 'no-data'
    return dayChecks.every((c) => c.is_up) ? 'up' : 'down'
  }

  const fleetUptime =
    sites.length > 0
      ? Math.round(
          (sites
            .flatMap((s) => s.checks)
            .filter((c) => c.is_up).length /
            Math.max(sites.flatMap((s) => s.checks).length, 1)) *
            1000
        ) / 10
      : null

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#E4E7EC]">Uptime Monitoring</h1>
          {fleetUptime !== null && (
            <p className="text-[#9BA1B0] text-sm mt-0.5">
              {fleetUptime}% average uptime across all sites
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#252836] rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={checkAllSites}
            disabled={checking}
            className="flex items-center gap-2 bg-[#D4A84B] hover:bg-[#c49535] disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {checking ? 'Checking…' : 'Check all now'}
          </button>
        </div>
      </div>

      <div className="bg-[#1A1D27] border border-[#D4A84B]/20 rounded-xl p-4">
        <p className="text-sm text-[#9BA1B0]">
          <span className="text-[#D4A84B] font-medium">Note:</span> Uptime checks run while this dashboard is open, every 5 minutes.
          For 24/7 monitoring, consider adding a scheduled Supabase Edge Function or external service like UptimeRobot.
          {lastChecked && ` Last checked: ${timeAgo(lastChecked.toISOString())}`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#1A1D27] rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => {
            const uptimePercent =
              site.checks.length > 0
                ? Math.round((site.checks.filter((c) => c.is_up).length / site.checks.length) * 1000) / 10
                : null

            return (
              <Card key={site.id} className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        site.currentStatus === false
                          ? 'bg-[#EF4444]'
                          : site.currentStatus === true
                          ? 'bg-[#22C55E]'
                          : 'bg-[#9BA1B0]'
                      }`}
                    />
                    <Link
                      href={`/sites/${site.id}`}
                      className="font-medium text-[#E4E7EC] hover:text-[#D4A84B] truncate transition-colors"
                    >
                      {site.name}
                    </Link>
                    {typeBadge(site.type)}
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-shrink-0">
                    {site.avgResponseTime && (
                      <span className="text-[#9BA1B0]">{site.avgResponseTime}ms avg</span>
                    )}
                    {uptimePercent !== null && (
                      <span
                        className={`font-semibold ${
                          uptimePercent > 99
                            ? 'text-[#22C55E]'
                            : uptimePercent > 95
                            ? 'text-[#F59E0B]'
                            : 'text-[#EF4444]'
                        }`}
                      >
                        {uptimePercent}%
                      </span>
                    )}
                  </div>
                </div>
                {/* Calendar blocks */}
                <div className="flex gap-0.5 overflow-x-auto">
                  {dates.map((date) => {
                    const status = getDateStatus(site.checks, date)
                    return (
                      <div
                        key={date}
                        title={`${date}: ${status}`}
                        className={`flex-1 min-w-[8px] h-6 rounded-sm ${
                          status === 'up'
                            ? 'bg-[#22C55E]'
                            : status === 'down'
                            ? 'bg-[#EF4444]'
                            : 'bg-[#2E3241]'
                        }`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between text-xs text-[#9BA1B0] mt-1">
                  <span>30 days ago</span>
                  <span>Today</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[#9BA1B0]">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#22C55E]" /> Up</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#EF4444]" /> Down</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#2E3241]" /> No data</div>
      </div>
    </div>
  )
}
