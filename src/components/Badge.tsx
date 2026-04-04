type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'gold' | 'muted'

const variants: Record<BadgeVariant, string> = {
  green: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  red: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  amber: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
  blue: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20',
  gold: 'bg-[#D4A84B]/10 text-[#D4A84B] border-[#D4A84B]/20',
  muted: 'bg-[#252836] text-[#9BA1B0] border-[#2E3241]',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'muted', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function typeBadge(type: string) {
  if (type === 'own') return <Badge variant="blue">Own</Badge>
  if (type === 'client') return <Badge variant="gold">Client</Badge>
  if (type === 'demo') return <Badge variant="muted">Demo</Badge>
  return <Badge>{type}</Badge>
}

export function statusBadge(status: string) {
  if (status === 'active') return <Badge variant="green">Active</Badge>
  if (status === 'development') return <Badge variant="amber">Dev</Badge>
  if (status === 'paused') return <Badge variant="amber">Paused</Badge>
  if (status === 'cancelled') return <Badge variant="red">Cancelled</Badge>
  return <Badge>{status}</Badge>
}

export function severityBadge(severity: string) {
  if (severity === 'critical') return <Badge variant="red">Critical</Badge>
  if (severity === 'warning') return <Badge variant="amber">Warning</Badge>
  if (severity === 'info') return <Badge variant="blue">Info</Badge>
  return <Badge>{severity}</Badge>
}

export function invoiceStatusBadge(status: string) {
  if (status === 'paid') return <Badge variant="green">Paid</Badge>
  if (status === 'pending') return <Badge variant="amber">Pending</Badge>
  if (status === 'sent') return <Badge variant="blue">Sent</Badge>
  if (status === 'overdue') return <Badge variant="red">Overdue</Badge>
  return <Badge>{status}</Badge>
}
