'use client'
export const runtime = 'edge'


import { useEffect, useState, useCallback } from 'react'
import { Plus, Rocket, AlertTriangle, MessageSquare, FileText, Headphones, RefreshCw as Update, Users } from 'lucide-react'
import { Activity, ActivityType, Site } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import Card from '@/components/Card'

const typeIcon: Record<ActivityType, React.ReactNode> = {
  deploy: <Rocket className="w-4 h-4 text-[#22C55E]" />,
  alert: <AlertTriangle className="w-4 h-4 text-[#EF4444]" />,
  note: <MessageSquare className="w-4 h-4 text-[#3B82F6]" />,
  invoice: <FileText className="w-4 h-4 text-[#D4A84B]" />,
  support: <Headphones className="w-4 h-4 text-[#F59E0B]" />,
  update: <Update className="w-4 h-4 text-[#8B5CF6]" />,
  client_comms: <Users className="w-4 h-4 text-[#EC4899]" />,
}

const typeColor: Record<ActivityType, string> = {
  deploy: 'text-[#22C55E]',
  alert: 'text-[#EF4444]',
  note: 'text-[#3B82F6]',
  invoice: 'text-[#D4A84B]',
  support: 'text-[#F59E0B]',
  update: 'text-[#8B5CF6]',
  client_comms: 'text-[#EC4899]',
}

export default function ActivityPage() {
  const [activity, setActivity] = useState<Activity[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ site_id: '', type: 'note' as ActivityType, title: '', description: '' })
  const [filterSite, setFilterSite] = useState('')
  const [filterType, setFilterType] = useState('')

  const fetchData = useCallback(async () => {
    const [actRes, sitesRes] = await Promise.all([
      fetch('/api/activity?limit=100'),
      fetch('/api/sites'),
    ])
    setActivity(await actRes.json())
    setSites(await sitesRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function addActivity() {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, site_id: form.site_id || null }),
    })
    setForm({ site_id: '', type: 'note', title: '', description: '' })
    setShowAdd(false)
    fetchData()
  }

  const filtered = activity.filter((a) => {
    if (filterSite && a.site_id !== filterSite) return false
    if (filterType && a.type !== filterType) return false
    return true
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-[#E4E7EC]">Activity Log</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add note
        </button>
      </div>

      {/* Add note form */}
      {showAdd && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Site (optional)</label>
                <select
                  value={form.site_id}
                  onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                  className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                >
                  <option value="">— No site —</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ActivityType })}
                  className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                >
                  {Object.keys(typeIcon).map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="What happened?"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261] resize-none"
                placeholder="Details..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={addActivity}
                disabled={!form.title}
                className="bg-[#D4A84B] hover:bg-[#c49535] disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Save
              </button>
              <button onClick={() => setShowAdd(false)} className="text-[#9BA1B0] text-sm px-4 py-2 hover:text-[#E4E7EC] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterSite}
          onChange={(e) => setFilterSite(e.target.value)}
          className="bg-[#1A1D27] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
        >
          <option value="">All sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-[#1A1D27] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
        >
          <option value="">All types</option>
          {Object.keys(typeIcon).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Activity feed */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-[#1A1D27] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-[#9BA1B0] text-sm">No activity found.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {typeIcon[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#E4E7EC]">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-[#9BA1B0] mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-[#9BA1B0] flex-shrink-0">{timeAgo(item.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {item.site?.name && (
                      <span className="text-xs text-[#9BA1B0]">{item.site.name}</span>
                    )}
                    <span className={`text-xs capitalize ${typeColor[item.type]}`}>
                      {item.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
