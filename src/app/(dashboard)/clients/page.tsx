'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Site } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { statusBadge } from '@/components/Badge'
import Card from '@/components/Card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ClientsPage() {
  const [clients, setClients] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchClients = useCallback(async () => {
    const res = await fetch('/api/sites')
    const data: Site[] = await res.json()
    setClients(data.filter((s) => s.type === 'client'))
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#E4E7EC]">Clients</h1>
        <Link
          href="/sites?add=1&type=client"
          className="flex items-center gap-2 bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add client
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-[#1A1D27] rounded-xl animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-[#9BA1B0] text-sm mb-4">No client sites yet.</p>
          <Link
            href="/sites?add=1"
            className="bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Add first client
          </Link>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2E3241]">
                      {['Client', 'Site', 'Monthly Fee', 'Contract Type', 'Contract End', 'Status', ''].map((h) => (
                        <th key={h} className="text-left text-[#9BA1B0] font-medium px-4 py-3 text-xs uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-[#2E3241] last:border-0 hover:bg-[#252836] cursor-pointer"
                        onClick={() => router.push(`/sites/${client.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-[#E4E7EC]">
                          {client.client_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#9BA1B0]">{client.name}</td>
                        <td className="px-4 py-3 text-[#E4E7EC]">{formatCurrency(client.monthly_fee)}</td>
                        <td className="px-4 py-3 text-[#9BA1B0] capitalize">
                          {client.contract_type?.replace(/_/g, ' ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#9BA1B0]">
                          {client.contract_end ? formatDate(client.contract_end) : '—'}
                        </td>
                        <td className="px-4 py-3">{statusBadge(client.status)}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/sites/${client.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[#3B82F6] hover:underline"
                          >
                            View
                          </Link>
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
            {clients.map((client) => (
              <Card
                key={client.id}
                className="p-4 cursor-pointer"
                onClick={() => router.push(`/sites/${client.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-[#E4E7EC]">{client.client_name || client.name}</p>
                    <p className="text-xs text-[#9BA1B0]">{client.name}</p>
                    <p className="text-sm text-[#D4A84B] mt-1">{formatCurrency(client.monthly_fee)}/mo</p>
                  </div>
                  {statusBadge(client.status)}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
