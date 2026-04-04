'use client'
export const runtime = 'edge'


import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Plus, X, CheckCircle, XCircle, Gamepad2 } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Site, Alert, Activity, Invoice } from '@/lib/types'
import { timeAgo, formatCurrency, getGreeting } from '@/lib/utils'
import StatusDot from '@/components/StatusDot'
import { typeBadge, invoiceStatusBadge } from '@/components/Badge'
import Card from '@/components/Card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SiteWithCheck extends Site {
  lastCheck?: { is_up: boolean; response_time_ms?: number; checked_at: string }
}

function DailyDuelSummaryCard() {
  const [dd, setDD] = useState<{ totalUsers: number; playedToday: number; avgScoreToday: number; deploy: { up: boolean } } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    fetch('/api/dailyduel', { signal: AbortSignal.timeout(12000) })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => { setDD(d); setError(false) })
      .catch(() => setError(true))
  }, [])

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-[#D4A84B]" />
          <span className="text-sm font-medium text-[#E4E7EC]">DailyDuel</span>
          {dd && (
            dd.deploy.up
              ? <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
              : <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
          )}
          {!dd && !error && <span className="w-3 h-3 rounded-full bg-[#2E3241] animate-pulse" />}
        </div>
        <Link href="/dailyduel" className="text-xs text-[#3B82F6] hover:underline">View →</Link>
      </div>
      {error ? (
        <p className="text-xs text-[#9BA1B0]">Could not load data</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-[#9BA1B0] mb-0.5">Users</p>
            <p className="font-semibold text-[#E4E7EC]">{dd ? dd.totalUsers : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9BA1B0] mb-0.5">Played Today</p>
            <p className="font-semibold text-[#E4E7EC]">{dd ? dd.playedToday : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9BA1B0] mb-0.5">Avg Score</p>
            <p className="font-semibold text-[#E4E7EC]">{dd ? `${dd.avgScoreToday}/10` : '—'}</p>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function OverviewPage() {
  const router = useRouter()
  const [sites, setSites] = useState<SiteWithCheck[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [trafficData, setTrafficData] = useState<Array<{ date: string; [key: string]: number | string }>>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<Set<string>>(new Set())
  const [discovery, setDiscovery] = useState<{ github: { repos: Array<{ name: string; full_name: string; description: string | null; updated_at: string }> }; cloudflare: { projects: Array<{ name: string; subdomain: string }> } } | null>(null)
  const [dismissedRepos, setDismissedRepos] = useState<string[]>([])

  const sitesRef = useRef<SiteWithCheck[]>([])

  const fetchData = useCallback(async () => {
    try {
      const timeout = 10000
      const [sitesRes, alertsRes, activityRes, invoicesRes] = await Promise.all([
        fetch('/api/sites', { signal: AbortSignal.timeout(timeout) }),
        fetch('/api/alerts?resolved=false', { signal: AbortSignal.timeout(timeout) }),
        fetch('/api/activity?limit=10', { signal: AbortSignal.timeout(timeout) }),
        fetch('/api/invoices', { signal: AbortSignal.timeout(timeout) }),
      ])
      const [sitesData, alertsData, activityData, invoicesData] = await Promise.all([
        sitesRes.ok ? sitesRes.json() : [],
        alertsRes.ok ? alertsRes.json() : [],
        activityRes.ok ? activityRes.json() : [],
        invoicesRes.ok ? invoicesRes.json() : [],
      ])
      sitesRef.current = sitesData
      setSites(sitesData)
      setAlerts(alertsData)
      setActivity(activityData)
      setInvoices(invoicesData)
      setLastRefresh(new Date())
      setLoading(false)

      // Fetch traffic for chart
      const trafficPromises = sitesData.slice(0, 5).map((s: Site) =>
        fetch(`/api/traffic?site_id=${s.id}`, { signal: AbortSignal.timeout(timeout) })
          .then((r) => r.ok ? r.json() : [])
          .catch(() => [])
      )
      const trafficResults = await Promise.all(trafficPromises)

      // Build combined chart data
      const dateMap = new Map<string, Record<string, number>>()
      sitesData.slice(0, 5).forEach((s: Site, i: number) => {
        const trafficArr = trafficResults[i] || []
        trafficArr.forEach((t: { date: string; unique_visitors: number }) => {
          if (!dateMap.has(t.date)) dateMap.set(t.date, {})
          dateMap.get(t.date)![s.name] = t.unique_visitors
        })
      })
      const combined = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, vals]) => ({ date: date.slice(5), ...vals }))
      setTrafficData(combined)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Load dismissed repos from localStorage
    const dismissed = JSON.parse(localStorage.getItem('ops_dismissed_repos') || '[]')
    setDismissedRepos(dismissed)

    fetch('/api/discovery')
      .then((r) => r.json())
      .then(setDiscovery)
      .catch(() => {})
  }, [fetchData])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Uptime checks every 5 min — use ref to avoid re-registering interval on every sites update
  useEffect(() => {
    const runChecks = async () => {
      const currentSites = sitesRef.current
      if (!currentSites.length) return
      for (const site of currentSites) {
        if (site.status !== 'active') continue
        setChecking((prev) => new Set(Array.from(prev).concat(site.id)))
        const start = Date.now()
        try {
          await fetch(`/api/sites/${site.id}/check`, { method: 'POST', signal: AbortSignal.timeout(15000) })
        } catch {}
        setChecking((prev) => {
          const n = new Set(prev)
          n.delete(site.id)
          return n
        })
        const elapsed = Date.now() - start
        setSites((prev) =>
          prev.map((s) =>
            s.id === site.id
              ? { ...s, lastCheck: { is_up: true, response_time_ms: elapsed, checked_at: new Date().toISOString() } }
              : s
          )
        )
      }
    }
    const interval = setInterval(runChecks, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  function dismissRepo(repoName: string) {
    const newDismissed = [...dismissedRepos, repoName]
    setDismissedRepos(newDismissed)
    localStorage.setItem('ops_dismissed_repos', JSON.stringify(newDismissed))
  }

  async function acknowledgeAlert(alertId: string) {
    await fetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged: true }),
    })
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }

  const downSites = sites.filter((s) => s.lastCheck?.is_up === false)
  const mrr = sites.filter((s) => s.status === 'active').reduce((sum, s) => sum + (s.monthly_fee || 0), 0)
  const avgResponseTime = sites
    .filter((s) => s.lastCheck?.response_time_ms)
    .reduce((sum, s, _, arr) => sum + (s.lastCheck?.response_time_ms || 0) / arr.length, 0)

  const siteColors = ['#3B82F6', '#22C55E', '#D4A84B', '#F59E0B', '#8B5CF6']

  const undiscoveredRepos =
    discovery?.github?.repos?.filter((r) => !dismissedRepos.includes(r.name)) || []
  const undiscoveredCF = discovery?.cloudflare?.projects || []
  const hasDiscoveries = undiscoveredRepos.length > 0 || undiscoveredCF.length > 0

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#1A1D27] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#E4E7EC]">{getGreeting()}, Akin</h1>
          <p className="text-[#9BA1B0] text-sm">
            Last refreshed {timeAgo(lastRefresh.toISOString())}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-[#1A1D27] border border-[#2E3241] hover:border-[#3B4261] text-[#E4E7EC] px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh all
        </button>
      </div>

      {/* Row 1 — Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Sites Monitored</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#E4E7EC]">{sites.length}</span>
            <StatusDot isUp={downSites.length === 0} size="sm" />
          </div>
          <p className="text-xs text-[#9BA1B0] mt-1">
            {downSites.length === 0 ? 'All systems operational' : `${downSites.length} site(s) down`}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Monthly Revenue</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#E4E7EC]">{formatCurrency(mrr)}</span>
            {mrr > 0 ? (
              <TrendingUp className="w-4 h-4 text-[#22C55E]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[#9BA1B0]" />
            )}
          </div>
          <p className="text-xs text-[#9BA1B0] mt-1">Active client MRR</p>
        </Card>

        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Active Alerts</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#E4E7EC]">{alerts.length}</span>
            {alerts.some((a) => a.severity === 'critical') && (
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            )}
          </div>
          <p className="text-xs text-[#9BA1B0] mt-1">
            {alerts.filter((a) => a.severity === 'critical').length} critical
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Avg Response Time</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#E4E7EC]">
              {avgResponseTime ? `${Math.round(avgResponseTime)}ms` : '—'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                avgResponseTime > 1000
                  ? 'bg-[#EF4444]'
                  : avgResponseTime > 500
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#22C55E]'
              }`}
            />
          </div>
          <p className="text-xs text-[#9BA1B0] mt-1">Across all sites</p>
        </Card>
      </div>

      {/* Row 2 — Site status grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide">Site Status</h2>
          <Link href="/sites" className="text-xs text-[#3B82F6] hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sites.map((site) => (
            <Card
              key={site.id}
              className="p-4 cursor-pointer hover:border-[#3B4261]"
              onClick={() => router.push(`/sites/${site.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot
                    isUp={site.lastCheck?.is_up !== false}
                    isChecking={checking.has(site.id)}
                    slow={(site.lastCheck?.response_time_ms || 0) > 2000}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#E4E7EC] truncate">{site.name}</p>
                    <p className="text-xs text-[#9BA1B0] truncate">{site.url.replace('https://', '')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {typeBadge(site.type)}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-[#9BA1B0]">
                <span>
                  {site.lastCheck?.response_time_ms
                    ? `${site.lastCheck.response_time_ms}ms`
                    : '—'}
                </span>
                <span>
                  {site.lastCheck ? timeAgo(site.lastCheck.checked_at) : 'Not checked yet'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Row 3 — Traffic + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic chart */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">
            Traffic Overview (30 days)
          </h2>
          {trafficData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trafficData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1D27',
                    border: '1px solid #2E3241',
                    borderRadius: '8px',
                    color: '#E4E7EC',
                    fontSize: '12px',
                  }}
                />
                {sites.slice(0, 5).map((s, i) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    stackId="1"
                    stroke={siteColors[i % siteColors.length]}
                    fill={siteColors[i % siteColors.length]}
                    fillOpacity={0.3}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-[#9BA1B0] text-sm">No traffic data available yet</p>
            </div>
          )}
        </Card>

        {/* Active alerts */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide">
              Active Alerts
            </h2>
            <Link href="/alerts" className="text-xs text-[#3B82F6] hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-[#9BA1B0] text-sm">
                No active alerts — all clear!
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between gap-3 p-3 bg-[#0F1117] rounded-lg"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        alert.severity === 'critical'
                          ? 'bg-[#EF4444]'
                          : alert.severity === 'warning'
                          ? 'bg-[#F59E0B]'
                          : 'bg-[#3B82F6]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-[#E4E7EC] truncate">{alert.title}</p>
                      <p className="text-xs text-[#9BA1B0]">{timeAgo(alert.created_at)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="text-xs text-[#9BA1B0] hover:text-[#E4E7EC] border border-[#2E3241] hover:border-[#3B4261] px-2 py-1 rounded flex-shrink-0 transition-colors"
                  >
                    Ack
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Row 4 — Billing + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billing summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide">
              Billing Summary
            </h2>
            <Link href="/billing" className="text-xs text-[#3B82F6] hover:underline">View all</Link>
          </div>
          {sites.filter((s) => s.type === 'client' && s.monthly_fee > 0).length === 0 ? (
            <div className="text-center py-8 text-[#9BA1B0] text-sm">
              No paying clients yet
            </div>
          ) : (
            <div className="space-y-2">
              {sites
                .filter((s) => s.type === 'client' && s.monthly_fee > 0)
                .map((site) => {
                  const invoice = invoices.find((inv) => inv.site_id === site.id)
                  return (
                    <div key={site.id} className="flex items-center justify-between py-2 border-b border-[#2E3241] last:border-0">
                      <div>
                        <p className="text-sm text-[#E4E7EC]">{site.client_name || site.name}</p>
                        <p className="text-xs text-[#9BA1B0]">{site.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[#E4E7EC]">{formatCurrency(site.monthly_fee)}</span>
                        {invoice ? invoiceStatusBadge(invoice.status) : invoiceStatusBadge('pending')}
                      </div>
                    </div>
                  )
                })}
              <div className="flex justify-between pt-2 font-semibold">
                <span className="text-[#9BA1B0] text-sm">Total MRR</span>
                <span className="text-[#22C55E]">{formatCurrency(mrr)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide">
              Recent Activity
            </h2>
            <Link href="/activity" className="text-xs text-[#3B82F6] hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {activity.length === 0 ? (
              <div className="text-center py-8 text-[#9BA1B0] text-sm">No activity yet</div>
            ) : (
              activity.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <span className="mt-1 w-2 h-2 rounded-full bg-[#3B82F6] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#E4E7EC] truncate">{item.title}</p>
                    <p className="text-xs text-[#9BA1B0]">
                      {item.site?.name && `${item.site.name} · `}{timeAgo(item.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Row 5 — Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide">Projects</h2>
          <Link href="/dailyduel" className="text-xs text-[#3B82F6] hover:underline">View all</Link>
        </div>
        <DailyDuelSummaryCard />
      </div>

      {/* Row 6 — Discovery panel */}
      {hasDiscoveries && (
        <Card className="p-4 border-[#D4A84B]/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#D4A84B] uppercase tracking-wide">
              New Projects Detected
            </h2>
            <button
              onClick={() => {
                undiscoveredRepos.forEach((r) => dismissRepo(r.name))
              }}
              className="text-xs text-[#9BA1B0] hover:text-[#E4E7EC] transition-colors"
            >
              Dismiss all
            </button>
          </div>
          <div className="space-y-3">
            {undiscoveredRepos.map((repo) => (
              <div
                key={repo.name}
                className="flex items-center justify-between p-3 bg-[#0F1117] rounded-lg gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#E4E7EC] font-medium">{repo.name}</p>
                  <p className="text-xs text-[#9BA1B0]">
                    GitHub · Updated {timeAgo(repo.updated_at)}
                    {repo.description && ` · ${repo.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/sites?add=1&name=${encodeURIComponent(repo.name)}&repo=${encodeURIComponent(repo.full_name)}`}
                    className="flex items-center gap-1 text-xs bg-[#D4A84B]/10 border border-[#D4A84B]/30 text-[#D4A84B] px-3 py-1.5 rounded-lg hover:bg-[#D4A84B]/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </Link>
                  <button
                    onClick={() => dismissRepo(repo.name)}
                    className="text-[#9BA1B0] hover:text-[#E4E7EC] p-1.5 rounded-lg hover:bg-[#252836] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {undiscoveredCF.map((project) => (
              <div
                key={project.name}
                className="flex items-center justify-between p-3 bg-[#0F1117] rounded-lg gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#E4E7EC] font-medium">{project.name}</p>
                  <p className="text-xs text-[#9BA1B0]">
                    Cloudflare Pages · {project.subdomain}.pages.dev
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/sites?add=1&name=${encodeURIComponent(project.name)}&url=${encodeURIComponent(`https://${project.subdomain}.pages.dev`)}`}
                    className="flex items-center gap-1 text-xs bg-[#D4A84B]/10 border border-[#D4A84B]/30 text-[#D4A84B] px-3 py-1.5 rounded-lg hover:bg-[#D4A84B]/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
