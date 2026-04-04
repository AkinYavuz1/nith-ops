import { Site, UptimeCheck, Alert, Traffic, Activity, Invoice } from './types'

export const mockSites: Site[] = [
  {
    id: '1',
    name: 'Nith Digital',
    url: 'https://nithdigital.uk',
    type: 'own',
    platform: 'cloudflare_pages',
    github_repo: 'AkinYavuz1/NithDigital',
    contract_type: 'internal',
    status: 'active',
    monthly_fee: 0,
    notes: 'Main consultancy website + Launchpad + Business OS',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Not an Octavia',
    url: 'https://not-an-octavia.uk',
    type: 'own',
    platform: 'cloudflare_pages',
    github_repo: 'AkinYavuz1/NotAnOctavia',
    contract_type: 'internal',
    status: 'active',
    monthly_fee: 0,
    notes: 'ML-curated used car deals site',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'gAIns',
    url: 'https://gainsai.uk',
    type: 'own',
    platform: 'cloudflare_pages',
    github_repo: 'AkinYavuz1/gymtracker',
    contract_type: 'internal',
    status: 'development',
    monthly_fee: 0,
    notes: 'AI-powered gym tracker — in development',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Tumble Tots',
    url: 'https://tumbletots.pages.dev',
    type: 'client',
    platform: 'cloudflare_pages',
    client_name: 'Carly',
    contract_type: 'pro_bono',
    status: 'active',
    monthly_fee: 0,
    notes: 'Pro bono childminding website for Carly',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export function generateMockUptimeChecks(siteId: string): UptimeCheck[] {
  const checks: UptimeCheck[] = []
  const now = Date.now()
  for (let i = 0; i < 48; i++) {
    const isUp = Math.random() > 0.05
    checks.push({
      id: `${siteId}-${i}`,
      site_id: siteId,
      status_code: isUp ? 200 : 503,
      response_time_ms: isUp ? Math.floor(Math.random() * 800 + 100) : undefined,
      is_up: isUp,
      checked_at: new Date(now - i * 30 * 60 * 1000).toISOString(),
    })
  }
  return checks
}

export function generateMockTraffic(siteId: string): Traffic[] {
  const data: Traffic[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      id: `${siteId}-traffic-${i}`,
      site_id: siteId,
      date: date.toISOString().split('T')[0],
      unique_visitors: Math.floor(Math.random() * 200 + 20),
      page_views: Math.floor(Math.random() * 600 + 60),
      bandwidth_bytes: Math.floor(Math.random() * 50000000),
      requests: Math.floor(Math.random() * 1000 + 100),
      threats_blocked: Math.floor(Math.random() * 5),
      top_pages: [
        { page: '/', views: Math.floor(Math.random() * 100 + 50) },
        { page: '/about', views: Math.floor(Math.random() * 50 + 10) },
        { page: '/contact', views: Math.floor(Math.random() * 30 + 5) },
      ],
      top_countries: [
        { country: 'GB', visitors: Math.floor(Math.random() * 100 + 50) },
        { country: 'US', visitors: Math.floor(Math.random() * 40 + 10) },
        { country: 'DE', visitors: Math.floor(Math.random() * 20 + 5) },
      ],
    })
  }
  return data
}

export const mockAlerts: Alert[] = [
  {
    id: 'a1',
    site_id: '3',
    type: 'site_slow',
    severity: 'warning',
    title: 'gAIns responding slowly',
    message: 'Response time exceeded 2000ms threshold',
    acknowledged: false,
    resolved: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'a2',
    site_id: '4',
    type: 'ssl_expiring',
    severity: 'info',
    title: 'SSL certificate expiring soon',
    message: 'SSL certificate for tumbletots.pages.dev expires in 25 days',
    acknowledged: false,
    resolved: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
]

export const mockActivity: Activity[] = [
  {
    id: 'act1',
    site_id: '1',
    type: 'deploy',
    title: 'Deployed to Cloudflare Pages',
    description: 'Pushed latest changes to main branch',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'act2',
    site_id: '3',
    type: 'update',
    title: 'Updated gym tracker features',
    description: 'Added AI workout suggestions module',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act3',
    site_id: '4',
    type: 'client_comms',
    title: 'Client call with Carly',
    description: 'Discussed adding a booking page for sessions',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act4',
    site_id: '2',
    type: 'deploy',
    title: 'ML model update deployed',
    description: 'Updated car recommendation algorithm',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
]

export const mockInvoices: Invoice[] = []
