export type SiteType = 'own' | 'client' | 'demo'
export type SiteStatus = 'active' | 'paused' | 'cancelled' | 'development'
export type ContractType = 'standard' | 'startup_bundle' | 'pro_bono' | 'internal'
export type AlertType = 'site_down' | 'site_slow' | 'ssl_expiring' | 'traffic_drop' | 'invoice_overdue' | 'contract_expiring' | 'error_detected'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type ActivityType = 'deploy' | 'alert' | 'note' | 'invoice' | 'support' | 'update' | 'client_comms'
export type InvoiceStatus = 'pending' | 'sent' | 'paid' | 'overdue'

export interface Site {
  id: string
  name: string
  url: string
  type: SiteType
  platform: string
  cloudflare_zone_id?: string
  github_repo?: string
  client_name?: string
  client_email?: string
  hosting_plan?: string
  monthly_fee: number
  contract_start?: string
  contract_end?: string
  contract_type?: ContractType
  status: SiteStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface UptimeCheck {
  id: string
  site_id: string
  status_code?: number
  response_time_ms?: number
  is_up: boolean
  error?: string
  checked_at: string
}

export interface Alert {
  id: string
  site_id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  acknowledged: boolean
  acknowledged_at?: string
  resolved: boolean
  resolved_at?: string
  created_at: string
  site?: Site
}

export interface Traffic {
  id: string
  site_id: string
  date: string
  unique_visitors: number
  page_views: number
  bandwidth_bytes: number
  requests: number
  threats_blocked: number
  top_pages: Array<{ page: string; views: number }>
  top_countries: Array<{ country: string; visitors: number }>
}

export interface Activity {
  id: string
  site_id?: string
  type: ActivityType
  title: string
  description?: string
  created_at: string
  site?: Site
}

export interface Invoice {
  id: string
  site_id: string
  month: string
  amount: number
  status: InvoiceStatus
  sent_at?: string
  paid_at?: string
  notes?: string
  created_at: string
  site?: Site
}
