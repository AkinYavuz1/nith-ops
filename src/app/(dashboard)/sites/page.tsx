'use client'
export const runtime = 'edge'


import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Search, ExternalLink, Pencil, Trash2, RefreshCw, GitBranch } from 'lucide-react'
import { Site, SiteType, SiteStatus } from '@/lib/types'
import StatusDot from '@/components/StatusDot'
import { typeBadge, statusBadge } from '@/components/Badge'
import Card from '@/components/Card'
import SiteModal from './SiteModal'

interface UntrackedRepo {
  name: string
  full_name: string
  html_url: string
  description: string | null
  homepage: string | null
  language: string | null
  updated_at: string
}

function SitesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [prefill, setPrefill] = useState<Partial<Site>>({})
  const [untrackedRepos, setUntrackedRepos] = useState<UntrackedRepo[]>([])
  const [dismissedRepos, setDismissedRepos] = useState<Set<string>>(new Set())

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch('/api/sites', { signal: AbortSignal.timeout(10000) })
      const data = res.ok ? await res.json() : []
      setSites(data)
    } catch {
      setSites([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSites()
    // Check if we should open the add modal from URL params
    if (searchParams.get('add') === '1') {
      const pre: Partial<Site> = { type: 'own', status: 'development' }
      if (searchParams.get('name')) pre.name = searchParams.get('name')!
      if (searchParams.get('repo')) pre.github_repo = searchParams.get('repo')!
      if (searchParams.get('url')) pre.url = searchParams.get('url')!
      setPrefill(pre)
      setShowModal(true)
    }
    // Fetch untracked GitHub repos via discovery
    fetch('/api/discovery', { signal: AbortSignal.timeout(10000) })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.github?.repos) setUntrackedRepos(d.github.repos) })
      .catch(() => {})
  }, [fetchSites, searchParams])

  function quickAddRepo(repo: UntrackedRepo) {
    const pre: Partial<Site> = {
      name: repo.name,
      github_repo: repo.full_name,
      type: 'own',
      status: 'development',
    }
    if (repo.homepage) pre.url = repo.homepage
    setPrefill(pre)
    setEditingSite(null)
    setShowModal(true)
  }

  async function deleteSite(id: string) {
    if (!confirm('Delete this site from monitoring?')) return
    await fetch(`/api/sites/${id}`, { method: 'DELETE' })
    fetchSites()
  }

  const filters = ['all', 'own', 'client', 'demo', 'active', 'development']

  const filtered = sites.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.url.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (filter === 'all') return true
    if (['own', 'client', 'demo'].includes(filter)) return s.type === (filter as SiteType)
    if (['active', 'development', 'paused', 'cancelled'].includes(filter))
      return s.status === (filter as SiteStatus)
    return true
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-[#E4E7EC]">Sites</h1>
        <button
          onClick={() => { setPrefill({}); setEditingSite(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add site
        </button>
      </div>

      {untrackedRepos.filter((r) => !dismissedRepos.has(r.full_name)).length > 0 && (
        <div className="bg-[#D4A84B]/10 border border-[#D4A84B]/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#D4A84B]" />
            <span className="text-sm font-semibold text-[#D4A84B]">
              {untrackedRepos.filter((r) => !dismissedRepos.has(r.full_name)).length} untracked GitHub{' '}
              {untrackedRepos.filter((r) => !dismissedRepos.has(r.full_name)).length === 1 ? 'repo' : 'repos'} detected
            </span>
          </div>
          <div className="space-y-2">
            {untrackedRepos
              .filter((r) => !dismissedRepos.has(r.full_name))
              .map((repo) => (
                <div key={repo.full_name} className="flex items-center justify-between gap-3 bg-[#1A1D27] rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#E4E7EC] truncate">{repo.name}</span>
                      {repo.language && (
                        <span className="text-xs text-[#9BA1B0]">{repo.language}</span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-[#9BA1B0] truncate mt-0.5">{repo.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1"
                    >
                      GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => quickAddRepo(repo)}
                      className="text-xs bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => setDismissedRepos((prev) => new Set([...prev, repo.full_name]))}
                      className="text-xs text-[#9BA1B0] hover:text-[#E4E7EC] px-1.5 py-1 rounded transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9BA1B0]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sites..."
            className="w-full bg-[#1A1D27] border border-[#2E3241] rounded-lg pl-9 pr-4 py-2 text-sm text-[#E4E7EC] placeholder-[#9BA1B0] focus:outline-none focus:border-[#3B4261]"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-[#252836] text-[#E4E7EC]'
                  : 'text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#252836]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={fetchSites}
          className="p-2 text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#252836] rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-[#1A1D27] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2E3241]">
                      <th className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Name</th>
                      <th className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">URL</th>
                      <th className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Type</th>
                      <th className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">Monthly Fee</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((site) => (
                      <tr
                        key={site.id}
                        className="border-b border-[#2E3241] last:border-0 hover:bg-[#252836] cursor-pointer"
                        onClick={() => router.push(`/sites/${site.id}`)}
                      >
                        <td className="px-4 py-3">
                          <StatusDot isUp={true} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#E4E7EC]">{site.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#3B82F6] hover:underline flex items-center gap-1"
                          >
                            {site.url.replace('https://', '')}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-4 py-3">{typeBadge(site.type)}</td>
                        <td className="px-4 py-3">{statusBadge(site.status)}</td>
                        <td className="px-4 py-3 text-[#9BA1B0]">
                          {site.monthly_fee > 0 ? `£${site.monthly_fee}/mo` : '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingSite(site); setShowModal(true) }}
                              className="p-1.5 text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#0F1117] rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSite(site.id)}
                              className="p-1.5 text-[#9BA1B0] hover:text-[#EF4444] hover:bg-[#0F1117] rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((site) => (
              <Card
                key={site.id}
                className="p-4 cursor-pointer"
                onClick={() => router.push(`/sites/${site.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot isUp={true} />
                    <div>
                      <p className="font-medium text-[#E4E7EC]">{site.name}</p>
                      <p className="text-xs text-[#9BA1B0]">{site.url.replace('https://', '')}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {typeBadge(site.type)}
                    {statusBadge(site.status)}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#9BA1B0]">
              No sites match your filters.
            </div>
          )}
        </>
      )}

      {showModal && (
        <SiteModal
          site={editingSite}
          prefill={prefill}
          onClose={() => { setShowModal(false); setEditingSite(null); setPrefill({}) }}
          onSave={() => { setShowModal(false); setEditingSite(null); setPrefill({}); fetchSites() }}
        />
      )}
    </div>
  )
}

export default function SitesPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-32 bg-[#1A1D27] rounded-xl animate-pulse" /></div>}>
      <SitesContent />
    </Suspense>
  )
}
