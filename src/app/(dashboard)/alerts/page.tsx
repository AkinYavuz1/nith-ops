'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { Alert } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { severityBadge } from '@/components/Badge'
import Card from '@/components/Card'

const severityIcon = {
  critical: <AlertCircle className="w-4 h-4 text-[#EF4444]" />,
  warning: <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />,
  info: <Info className="w-4 h-4 text-[#3B82F6]" />,
}

export default function AlertsPage() {
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([])
  const [resolvedAlerts, setResolvedAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    const [activeRes, resolvedRes] = await Promise.all([
      fetch('/api/alerts?resolved=false'),
      fetch('/api/alerts?resolved=true'),
    ])
    setActiveAlerts(await activeRes.json())
    setResolvedAlerts(await resolvedRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  async function updateAlert(id: string, update: { acknowledged?: boolean; resolved?: boolean }) {
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    fetchAlerts()
  }

  const sorted = [...activeAlerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return (order[a.severity] - order[b.severity]) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#E4E7EC]">Alerts Centre</h1>
          <p className="text-[#9BA1B0] text-sm mt-0.5">
            {activeAlerts.length} active · {resolvedAlerts.length} resolved
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="p-2 text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#252836] rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Active alerts */}
      <div>
        <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-3">Active</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-[#1A1D27] rounded-xl animate-pulse" />)}
          </div>
        ) : sorted.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-[#22C55E] text-lg mb-1">All clear!</p>
            <p className="text-[#9BA1B0] text-sm">No active alerts. All systems operational.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sorted.map((alert) => (
              <Card key={alert.id} className={`p-4 border-l-4 ${
                alert.severity === 'critical' ? 'border-l-[#EF4444]' :
                alert.severity === 'warning' ? 'border-l-[#F59E0B]' : 'border-l-[#3B82F6]'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">
                      {severityIcon[alert.severity]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-[#E4E7EC]">{alert.title}</p>
                        {severityBadge(alert.severity)}
                        {alert.acknowledged && (
                          <span className="text-xs text-[#9BA1B0]">Acknowledged</span>
                        )}
                      </div>
                      <p className="text-xs text-[#9BA1B0] mt-0.5">{alert.message}</p>
                      <p className="text-xs text-[#9BA1B0] mt-1">
                        {alert.site?.name && <span className="text-[#E4E7EC]">{alert.site.name} · </span>}
                        {timeAgo(alert.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => updateAlert(alert.id, { acknowledged: true })}
                        className="text-xs border border-[#2E3241] hover:border-[#3B4261] text-[#9BA1B0] hover:text-[#E4E7EC] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => updateAlert(alert.id, { resolved: true })}
                      className="text-xs bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] px-3 py-1.5 rounded-lg hover:bg-[#22C55E]/20 transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Resolved history */}
      {resolvedAlerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-3">History</h2>
          <div className="space-y-2">
            {resolvedAlerts.slice(0, 20).map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 p-3 bg-[#1A1D27] border border-[#2E3241] rounded-lg opacity-60">
                <div className="flex-shrink-0">{severityIcon[alert.severity]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E4E7EC] truncate">{alert.title}</p>
                  <p className="text-xs text-[#9BA1B0]">
                    {alert.site?.name && `${alert.site.name} · `}
                    Resolved · {timeAgo(alert.resolved_at || alert.created_at)}
                  </p>
                </div>
                {severityBadge(alert.severity)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
