'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Site, SiteType, SiteStatus, ContractType } from '@/lib/types'

interface SiteModalProps {
  site: Site | null
  prefill?: Partial<Site>
  onClose: () => void
  onSave: () => void
}

export default function SiteModal({ site, prefill, onClose, onSave }: SiteModalProps) {
  const [form, setForm] = useState<Partial<Site>>({
    name: '',
    url: '',
    type: 'own',
    platform: 'cloudflare_pages',
    status: 'active',
    monthly_fee: 0,
    contract_type: 'internal',
    ...prefill,
    ...site,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function update(key: keyof Site, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const method = site ? 'PATCH' : 'POST'
    const url = site ? `/api/sites/${site.id}` : '/api/sites'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1A1D27] border border-[#2E3241] rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[#2E3241]">
          <h2 className="text-lg font-semibold text-[#E4E7EC]">{site ? 'Edit Site' : 'Add Site'}</h2>
          <button onClick={onClose} className="text-[#9BA1B0] hover:text-[#E4E7EC] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Site Name *</label>
              <input
                value={form.name || ''}
                onChange={(e) => update('name', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="My Site"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">URL *</label>
              <input
                value={form.url || ''}
                onChange={(e) => update('url', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Type</label>
              <select
                value={form.type || 'own'}
                onChange={(e) => update('type', e.target.value as SiteType)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              >
                <option value="own">Own</option>
                <option value="client">Client</option>
                <option value="demo">Demo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Status</label>
              <select
                value={form.status || 'active'}
                onChange={(e) => update('status', e.target.value as SiteStatus)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              >
                <option value="active">Active</option>
                <option value="development">Development</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">GitHub Repo</label>
              <input
                value={form.github_repo || ''}
                onChange={(e) => update('github_repo', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="AkinYavuz1/my-repo"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Cloudflare Zone ID</label>
              <input
                value={form.cloudflare_zone_id || ''}
                onChange={(e) => update('cloudflare_zone_id', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="abc123..."
              />
            </div>

            {/* Client section */}
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Client Name</label>
              <input
                value={form.client_name || ''}
                onChange={(e) => update('client_name', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="Client name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Client Email</label>
              <input
                value={form.client_email || ''}
                onChange={(e) => update('client_email', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="client@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Monthly Fee (£)</label>
              <input
                type="number"
                value={form.monthly_fee || 0}
                onChange={(e) => update('monthly_fee', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Contract Type</label>
              <select
                value={form.contract_type || 'internal'}
                onChange={(e) => update('contract_type', e.target.value as ContractType)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              >
                <option value="internal">Internal</option>
                <option value="standard">Standard</option>
                <option value="startup_bundle">Startup Bundle</option>
                <option value="pro_bono">Pro Bono</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Contract Start</label>
              <input
                type="date"
                value={form.contract_start || ''}
                onChange={(e) => update('contract_start', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Contract End</label>
              <input
                type="date"
                value={form.contract_end || ''}
                onChange={(e) => update('contract_end', e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={(e) => update('notes', e.target.value)}
                rows={3}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261] resize-none"
                placeholder="Any notes..."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#2E3241]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#9BA1B0] hover:text-[#E4E7EC] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.url}
            className="bg-[#D4A84B] hover:bg-[#c49535] disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Saving…' : 'Save site'}
          </button>
        </div>
      </div>
    </div>
  )
}
