'use client'
export const runtime = 'edge'


import { useEffect, useState, useCallback } from 'react'
import { PlusCircle, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Site, Invoice } from '@/lib/types'
import { formatCurrency, getCurrentMonth, formatDate } from '@/lib/utils'
import { invoiceStatusBadge } from '@/components/Badge'
import Card from '@/components/Card'

export default function BillingPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchData = useCallback(async () => {
    const [sitesRes, invoicesRes] = await Promise.all([
      fetch('/api/sites'),
      fetch('/api/invoices'),
    ])
    setSites(await sitesRes.json())
    setInvoices(await invoicesRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const currentMonth = getCurrentMonth()
  const clientSites = sites.filter((s) => s.type === 'client' && s.monthly_fee > 0 && s.status === 'active')
  const currentMonthInvoices = invoices.filter((inv) => inv.month === currentMonth)
  const mrr = clientSites.reduce((sum, s) => sum + s.monthly_fee, 0)

  async function generateInvoices() {
    setGenerating(true)
    for (const site of clientSites) {
      const exists = currentMonthInvoices.find((inv) => inv.site_id === site.id)
      if (!exists) {
        await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            site_id: site.id,
            month: currentMonth,
            amount: site.monthly_fee,
            status: 'pending',
          }),
        })
      }
    }
    setGenerating(false)
    fetchData()
  }

  async function updateInvoice(id: string, status: string) {
    await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchData()
  }

  // Build revenue chart (last 12 months)
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    return d.toISOString().slice(0, 7)
  })

  const chartData = months.map((m) => {
    const monthInvoices = invoices.filter((inv) => inv.month === m)
    const entry: Record<string, string | number> = { month: m.slice(0, 7) }
    clientSites.forEach((s) => {
      const inv = monthInvoices.find((i) => i.site_id === s.id && i.status === 'paid')
      entry[s.client_name || s.name] = inv?.amount || 0
    })
    return entry
  })

  const colors = ['#3B82F6', '#22C55E', '#D4A84B', '#F59E0B', '#8B5CF6']
  const tooltipStyle = {
    backgroundColor: '#1A1D27',
    border: '1px solid #2E3241',
    borderRadius: '8px',
    color: '#E4E7EC',
    fontSize: '12px',
  }

  const thisYearRevenue = invoices
    .filter((inv) => inv.month.startsWith(new Date().getFullYear().toString()) && inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const paidThisMonth = currentMonthInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const pendingThisMonth = currentMonthInvoices.filter((i) => ['pending', 'sent'].includes(i.status)).reduce((s, i) => s + i.amount, 0)
  const overdueThisMonth = currentMonthInvoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-[#E4E7EC]">Billing</h1>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 text-[#9BA1B0] hover:text-[#E4E7EC] hover:bg-[#252836] rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={generateInvoices}
            disabled={generating || clientSites.length === 0}
            className="flex items-center gap-2 bg-[#D4A84B] hover:bg-[#c49535] disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            {generating ? 'Generating…' : "Generate this month's invoices"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">MRR</p>
          <p className="text-2xl font-bold text-[#22C55E]">{formatCurrency(mrr)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Paid</p>
          <p className="text-2xl font-bold text-[#22C55E]">{formatCurrency(paidThisMonth)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Pending</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{formatCurrency(pendingThisMonth)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[#9BA1B0] text-xs uppercase tracking-wide mb-1">Overdue</p>
          <p className="text-2xl font-bold text-[#EF4444]">{formatCurrency(overdueThisMonth)}</p>
        </Card>
      </div>

      {/* Current month invoices */}
      <div>
        <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-3">
          {currentMonth} — Current Month
        </h2>
        {loading ? (
          <div className="h-32 bg-[#1A1D27] rounded-xl animate-pulse" />
        ) : currentMonthInvoices.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-[#9BA1B0] text-sm mb-4">No invoices for this month yet.</p>
            {clientSites.length > 0 && (
              <button
                onClick={generateInvoices}
                className="text-sm text-[#D4A84B] hover:underline"
              >
                Generate invoices for {clientSites.length} client{clientSites.length !== 1 ? 's' : ''}
              </button>
            )}
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2E3241]">
                    {['Client', 'Site', 'Amount', 'Status', 'Sent', 'Paid', 'Actions'].map((h) => (
                      <th key={h} className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentMonthInvoices.map((inv) => {
                    const site = sites.find((s) => s.id === inv.site_id)
                    return (
                      <tr key={inv.id} className="border-b border-[#2E3241] last:border-0">
                        <td className="px-4 py-3 text-[#E4E7EC]">{site?.client_name || '—'}</td>
                        <td className="px-4 py-3 text-[#9BA1B0]">{site?.name || '—'}</td>
                        <td className="px-4 py-3 text-[#E4E7EC] font-medium">{formatCurrency(inv.amount)}</td>
                        <td className="px-4 py-3">{invoiceStatusBadge(inv.status)}</td>
                        <td className="px-4 py-3 text-[#9BA1B0] text-xs">{inv.sent_at ? formatDate(inv.sent_at) : '—'}</td>
                        <td className="px-4 py-3 text-[#9BA1B0] text-xs">{inv.paid_at ? formatDate(inv.paid_at) : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {inv.status === 'pending' && (
                              <button
                                onClick={() => updateInvoice(inv.id, 'sent')}
                                className="text-xs text-[#3B82F6] hover:underline"
                              >
                                Mark sent
                              </button>
                            )}
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => updateInvoice(inv.id, 'paid')}
                                className="text-xs text-[#22C55E] hover:underline"
                              >
                                Mark paid
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Revenue chart */}
      {clientSites.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-4">
            Revenue — Last 12 Months
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1B0' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9BA1B0' }} tickFormatter={(v) => `£${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === 'number' ? formatCurrency(v) : String(v)} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#9BA1B0' }} />
              {clientSites.map((s, i) => (
                <Bar key={s.id} dataKey={s.client_name || s.name} stackId="a" fill={colors[i % colors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Annual summary */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#9BA1B0] uppercase tracking-wide mb-3">Annual Summary</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[#9BA1B0] text-xs mb-1">This Year Revenue</p>
            <p className="text-xl font-bold text-[#22C55E]">{formatCurrency(thisYearRevenue)}</p>
          </div>
          <div>
            <p className="text-[#9BA1B0] text-xs mb-1">Annual Projection</p>
            <p className="text-xl font-bold text-[#E4E7EC]">{formatCurrency(mrr * 12)}</p>
          </div>
          <div>
            <p className="text-[#9BA1B0] text-xs mb-1">Active Clients</p>
            <p className="text-xl font-bold text-[#E4E7EC]">{clientSites.length}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
