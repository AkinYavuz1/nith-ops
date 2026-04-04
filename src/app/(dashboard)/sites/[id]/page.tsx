'use client'
export const runtime = 'edge'


import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ExternalLink, ArrowLeft, RefreshCw, Pencil, GitBranch, Clock3 } from 'lucide-react'
import { Site, UptimeCheck, Alert, Activity, Invoice } from '@/lib/types'
import { timeAgo, formatDate, formatCurrency } from '@/lib/utils'
import StatusDot from '@/components/StatusDot'
import { typeBadge, statusBadge, severityBadge, invoiceStatusBadge } from '@/components/Badge'
import Card from '@/components/Card'
import SiteModal from '../SiteModal'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const TABS = ['Health', 'Traffic', 'Alerts', 'Activity', 'Client'] as const
type Tab = (typeof TABS)[number]

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [site, setSite] = useState<Site | null>(null)
  const [tab, setTab] = useState<Tab>('Health')
  const [uptimeChecks, setUptimeChecks] = useState<UptimeCheck[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [traffic, setTraffic] = useState<Array<{ date: string; unique_visitors: number; page_views: number }>>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [githubData, setGithubData] = useState<{ commits: Array<{ sha: string; commit: { message: string; author: { date: string; name: string } } }>; prs: number } | null>(null)

  const fetchAll = useCallback(async () => {
    const [siteRes, uptimeRes, alertsRes, activityRes, invoicesRes, trafficRes] = await Promise.all([
      fetch(`/api/sites/${id}`),
      fetch(`/api/uptime?site_id=${id}&limit=50`),
      fetch(`/api/alerts?site_id=${id}`),
      fetch(`/api/activity?site_id=${id}`),
      fetch(`/api/invoices?site_id=${id}`),
      fetch(`/api/traffic?site_id=${id}`),
    ])
    const [siteData, uptimeData, alertsData, activityData, invoicesData, trafficData] =
      await Promise.all([siteRes.json(), uptimeRes.json(), alertsRes.json(), activityRes.json(), invoicesRes.json(), trafficRes.json()])
    setSite(siteData)
    setUptimeChecks(uptimeData)
    setAlerts(alertsData)
    setActivity(activityData)
    setInvoices(invoicesData)
    setTraffic(Array.isArray(trafficData) ? trafficData.reverse() : [])
    setLoading(false)

    // GitHub data
    if (siteData.github_repo && process.env.NEXT_PUBLIC_GITHUB_TOKEN) {
      const [commitsRes, prsRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${siteData.github_repo}/commits?per_page=5`),
        fetch(`https://api.github.com/repos/${siteData.github_repo}/pulls?state=open`),
      ])
      const [commits, prs] = await Promise.all([commitsRes.json(), prsRes.json()])
      setGithubData({ commits: Array.isArray(commits) ? commits : [], prs: Array.isArray(prs) ? prs.length : 0 })
    }
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function acknowledgeAlert(alertId: string, resolve = false) {
    await fetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolve ? { resolved: true } : { acknowledged: true }),
    })
    fetchAll()
  }

  async function addNote() {
    if (!newNote.trim()) return
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: id, type: 'note', title: newNote }),
    })
    setNewNote('')
    fetchAll()
  }

  async function createInvoice() {
    if (!site) return
    const month = new Date().toISOString().slice(0, 7)
    await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: id, month, amount: site.monthly_fee, status: 'pending' }),
    })
    fetchAll()
  }

  async function markInvoicePaid(invoiceId: string) {
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' }),
    })
    fetchAll()
  }

  async function runCheck() {
    await fetch(`/api/sites/${id}/check`, { method: 'POST' })
    fetchAll()
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-[#1A1D27] rounded-xl animate-pulse" />)}
    </div>
  )

  if (!site) return (
    <div className="p-6 text-center text-[#9BA1B0]">Site not found.</div>
  )

  const latestCheck = uptimeChecks[0]
  const uptimePercent = uptimeChecks.length
    ? Math.round((uptimeChecks.filter((c) => c.is_up).length / uptimeChecks.length) * 1000) / 10
    : null

  const responseTimeData = uptimeChecks
    .slice(0, 24)
    .reverse()
    .map((c) => ({ time: timeAgo(c.checked_at), ms: c.response_time_ms || 0, up: c.is_up }))

  const visibleTabs = site.type === 'client' ? TABS : TABS.filter((t) => t !== 'Client')

  const tooltipStyle = {
    backgroundColor: '#1A1D27',
    border: '1px solid #2E3241',
    borderRadius: '8px',
    color: '#E4E7EC',
    fontSize: '12px',
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <button onClick={() => router.push('/sites')} className="text-[#9BA1B0] hover:text-[#E4E7EC] mt-1 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#E4E7EC]">{site.name}</h1>
            {typeBadge(site.type)}
            {statusBadge(site.status)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B82F6] hover:underline text-sm flex items-center gap-1"
            >
              {site.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runCheck}
            className="flex items-center gap-2 bg-[#1A1D27] border border-[#2E3241] hover:border-[#3B4261] text-[#E4E7EC] px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Check now
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2E3241] overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              tab === t
                ? 'text-[#E4E7EC] border-[#D4A84B]'
                : 'text-[#9BA1B0] border-transparent hover:text-[#E4E7EC]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Health */}
      {tab === 'Health' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-2">Current Status</p>
              <div className="flex items-center gap-2">
                <StatusDot isUp={latestCheck?.is_up !== false} size="lg" />
                <span className="text-xl font-bold text-[#E4E7EC]">
                  {latestCheck?.is_up !== false ? 'Online' : 'Down'}
                </span>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-2">Response Time</p>
              <p className="text-xl font-bold text-[#E4E7EC]">
                {latestCheck?.response_time_ms ? `${latestCheck.response_time_ms}ms` : '—'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-2">Uptime (30d)</p>
              <p className={`text-xl font-bold ${uptimePercent && uptimePercent > 99 ? 'text-[#22C55E]' : uptimePercent && uptimePercent > 95 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                {uptimePercent !== null ? `${uptimePercent}%` : '—'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-2">Last Checked</p>
              <p className="text-xl font-bold text-[#E4E7EC]">
                {latestCheck ? timeAgo(latestCheck.checked_at) : '—'}
              </p>
            </Card>
          </div>

          {responseTimeData.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">Response Time (last 24 checks)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={responseTimeData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} unit="ms" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="ms" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {githubData && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">
                <GitBranch className="inline w-4 h-4 mr-1" />
                GitHub
              </h3>
              <div className="space-y-2">
                {githubData.prs > 0 && (
                  <p className="text-sm text-[#F59E0B]">{githubData.prs} open pull request{githubData.prs !== 1 ? 's' : ''}</p>
                )}
                {githubData.commits.slice(0, 3).map((c) => (
                  <div key={c.sha} className="flex items-start gap-2 text-sm">
                    <code className="text-[#9BA1B0] text-xs">{c.sha.slice(0, 7)}</code>
                    <span className="text-[#E4E7EC] flex-1 truncate">{c.commit.message.split('\n')[0]}</span>
                    <span className="text-[#9BA1B0] text-xs flex-shrink-0">{timeAgo(c.commit.author.date)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {site.github_repo && !githubData && (
            <Card className="p-4">
              <p className="text-sm text-[#9BA1B0]">
                GitHub repo linked: <span className="text-[#E4E7EC]">{site.github_repo}</span>. Add <code className="bg-[#0F1117] px-1 rounded text-xs">NEXT_PUBLIC_GITHUB_TOKEN</code> to see commits.
              </p>
            </Card>
          )}

          {/* Recent checks table */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">
              <Clock3 className="inline w-4 h-4 mr-1" />
              Recent Uptime Checks
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2E3241]">
                    <th className="text-left text-[#9BA1B0] text-xs py-2 pr-4">Status</th>
                    <th className="text-left text-[#9BA1B0] text-xs py-2 pr-4">Response</th>
                    <th className="text-left text-[#9BA1B0] text-xs py-2 pr-4">HTTP</th>
                    <th className="text-left text-[#9BA1B0] text-xs py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {uptimeChecks.slice(0, 20).map((check) => (
                    <tr key={check.id} className="border-b border-[#2E3241] last:border-0">
                      <td className="py-2 pr-4">
                        <StatusDot isUp={check.is_up} size="sm" />
                      </td>
                      <td className="py-2 pr-4 text-[#9BA1B0]">
                        {check.response_time_ms ? `${check.response_time_ms}ms` : '—'}
                      </td>
                      <td className="py-2 pr-4 text-[#9BA1B0]">{check.status_code || '—'}</td>
                      <td className="py-2 text-[#9BA1B0] text-xs">{timeAgo(check.checked_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Traffic */}
      {tab === 'Traffic' && (
        <div className="space-y-4">
          {traffic.length === 0 ? (
            <Card className="p-6">
              <p className="text-[#9BA1B0] text-sm text-center">
                No traffic data yet. Connect Cloudflare to see real data.
              </p>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">Daily Visitors</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={traffic}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="unique_visitors" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">Page Views</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={traffic}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="page_views" fill="#22C55E" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab: Alerts */}
      {tab === 'Alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <Card className="p-6 text-center text-[#9BA1B0] text-sm">No alerts for this site.</Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div>{severityBadge(alert.severity)}</div>
                    <div>
                      <p className="text-sm font-medium text-[#E4E7EC]">{alert.title}</p>
                      <p className="text-xs text-[#9BA1B0] mt-0.5">{alert.message}</p>
                      <p className="text-xs text-[#9BA1B0] mt-1">{timeAgo(alert.created_at)}</p>
                    </div>
                  </div>
                  {!alert.resolved && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="text-xs border border-[#2E3241] hover:border-[#3B4261] text-[#9BA1B0] hover:text-[#E4E7EC] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Ack
                        </button>
                      )}
                      <button
                        onClick={() => acknowledgeAlert(alert.id, true)}
                        className="text-xs bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] px-3 py-1.5 rounded-lg hover:bg-[#22C55E]/20 transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab: Activity */}
      {tab === 'Activity' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex gap-2">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add a note..."
                className="flex-1 bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] placeholder-[#9BA1B0] focus:outline-none focus:border-[#3B4261]"
              />
              <button
                onClick={addNote}
                disabled={!newNote.trim()}
                className="bg-[#D4A84B] hover:bg-[#c49535] disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
          </Card>
          <div className="space-y-3">
            {activity.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-[#3B82F6] flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#E4E7EC]">{item.title}</p>
                    {item.description && <p className="text-xs text-[#9BA1B0] mt-0.5">{item.description}</p>}
                    <p className="text-xs text-[#9BA1B0] mt-1">{item.type} · {timeAgo(item.created_at)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Client */}
      {tab === 'Client' && site.type === 'client' && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">Client Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[#9BA1B0] text-xs">Name</p>
                <p className="text-[#E4E7EC] mt-1">{site.client_name || '—'}</p>
              </div>
              <div>
                <p className="text-[#9BA1B0] text-xs">Email</p>
                <p className="text-[#E4E7EC] mt-1">{site.client_email || '—'}</p>
              </div>
              <div>
                <p className="text-[#9BA1B0] text-xs">Monthly Fee</p>
                <p className="text-[#E4E7EC] mt-1">{formatCurrency(site.monthly_fee)}</p>
              </div>
              <div>
                <p className="text-[#9BA1B0] text-xs">Contract Type</p>
                <p className="text-[#E4E7EC] mt-1 capitalize">{site.contract_type?.replace(/_/g, ' ') || '—'}</p>
              </div>
              {site.contract_start && (
                <div>
                  <p className="text-[#9BA1B0] text-xs">Contract Start</p>
                  <p className="text-[#E4E7EC] mt-1">{formatDate(site.contract_start)}</p>
                </div>
              )}
              {site.contract_end && (
                <div>
                  <p className="text-[#9BA1B0] text-xs">Contract End</p>
                  <p className="text-[#E4E7EC] mt-1">{formatDate(site.contract_end)}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide">Invoices</h3>
              <button
                onClick={createInvoice}
                className="text-xs bg-[#D4A84B]/10 border border-[#D4A84B]/30 text-[#D4A84B] px-3 py-1.5 rounded-lg hover:bg-[#D4A84B]/20 transition-colors"
              >
                Create invoice
              </button>
            </div>
            <div className="space-y-2">
              {invoices.length === 0 ? (
                <p className="text-[#9BA1B0] text-sm">No invoices yet.</p>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-[#2E3241] last:border-0">
                    <div>
                      <p className="text-sm text-[#E4E7EC]">{inv.month}</p>
                      <p className="text-xs text-[#9BA1B0]">{formatCurrency(inv.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {invoiceStatusBadge(inv.status)}
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => markInvoicePaid(inv.id)}
                          className="text-xs text-[#22C55E] hover:underline"
                        >
                          Mark paid
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {invoices.length > 0 && (
              <div className="pt-3 flex justify-between font-semibold text-sm">
                <span className="text-[#9BA1B0]">Total Revenue</span>
                <span className="text-[#22C55E]">{formatCurrency(invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0))}</span>
              </div>
            )}
          </Card>
        </div>
      )}

      {showEdit && (
        <SiteModal
          site={site}
          onClose={() => setShowEdit(false)}
          onSave={() => { setShowEdit(false); fetchAll() }}
        />
      )}
    </div>
  )
}
