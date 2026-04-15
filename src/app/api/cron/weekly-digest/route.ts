import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

// Weekly digest email — call every Monday morning.
// GET /api/cron/weekly-digest?secret=YOUR_CRON_SECRET
// Summarises: site health, active alerts, MRR, overdue invoices.

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Nith Ops <digest@nithdigital.uk>', to, subject, html }),
  })
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const alertEmail = process.env.ALERT_EMAIL || 'akin@nithdigital.uk'

  // Fetch all data in parallel
  const [sitesRes, alertsRes, invoicesRes, uptimeRes] = await Promise.all([
    supabase.from('ops_sites').select('id, name, url, type, status, monthly_fee, client_name').order('name'),
    supabase.from('ops_alerts').select('id, site_id, type, severity, title, created_at').eq('resolved', false).order('created_at', { ascending: false }),
    supabase.from('ops_invoices').select('id, site_id, amount, status, month').in('status', ['pending', 'overdue']),
    supabase.from('ops_uptime_checks')
      .select('site_id, is_up, checked_at')
      .gte('checked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('checked_at', { ascending: false }),
  ])

  const sites = sitesRes.data ?? []
  const alerts = alertsRes.data ?? []
  const invoices = invoicesRes.data ?? []
  const uptimeChecks = uptimeRes.data ?? []

  // Calculate per-site uptime % over last 7 days
  const uptimeMap: Record<string, { total: number; up: number }> = {}
  for (const check of uptimeChecks) {
    if (!uptimeMap[check.site_id]) uptimeMap[check.site_id] = { total: 0, up: 0 }
    uptimeMap[check.site_id].total++
    if (check.is_up) uptimeMap[check.site_id].up++
  }

  const activeSites = sites.filter(s => s.status === 'active')
  const clientSites = sites.filter(s => s.type === 'client' && s.status === 'active')
  const mrr = clientSites.reduce((sum, s) => sum + (s.monthly_fee || 0), 0)
  const overdueInvoices = invoices.filter(i => i.status === 'overdue')
  const pendingInvoices = invoices.filter(i => i.status === 'pending')
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  // Build site health rows
  const siteRows = activeSites.map(site => {
    const u = uptimeMap[site.id]
    const uptimePct = u && u.total > 0 ? Math.round((u.up / u.total) * 100) : null
    const hasAlert = alerts.some(a => a.site_id === site.id)
    const statusColor = uptimePct === null ? '#94a3b8' : uptimePct >= 99 ? '#16a34a' : uptimePct >= 95 ? '#d97706' : '#dc2626'
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-size:13px">${site.name}${site.client_name ? ` <span style="color:#94a3b8">(${site.client_name})</span>` : ''}</td>
      <td style="padding:8px 12px;font-size:13px"><a href="${site.url}" style="color:#3b82f6">${site.url.replace('https://', '')}</a></td>
      <td style="padding:8px 12px;font-size:13px;color:${statusColor};font-weight:600">${uptimePct !== null ? `${uptimePct}%` : '—'}</td>
      <td style="padding:8px 12px;font-size:13px">${hasAlert ? '<span style="color:#dc2626">⚠ Alert</span>' : '<span style="color:#16a34a">✓ OK</span>'}</td>
    </tr>`
  }).join('')

  // Build alerts section
  const alertRows = alerts.slice(0, 10).map(a => {
    const severityColor = a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#d97706' : '#3b82f6'
    const site = sites.find(s => s.id === a.site_id)
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-size:13px"><span style="color:${severityColor};font-weight:600;text-transform:uppercase;font-size:11px">${a.severity}</span></td>
      <td style="padding:8px 12px;font-size:13px">${a.title}</td>
      <td style="padding:8px 12px;font-size:13px;color:#64748b">${site?.name || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;color:#94a3b8">${new Date(a.created_at).toLocaleDateString('en-GB')}</td>
    </tr>`
  }).join('')

  // Overdue invoices section
  const overdueRows = overdueInvoices.map(inv => {
    const site = sites.find(s => s.id === inv.site_id)
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-size:13px">${site?.client_name || site?.name || '—'}</td>
      <td style="padding:8px 12px;font-size:13px">£${inv.amount}</td>
      <td style="padding:8px 12px;font-size:13px;color:#94a3b8">${inv.month}</td>
    </tr>`
  }).join('')

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const subjectLine = criticalAlerts.length > 0
    ? `⚠️ Nith Ops digest — ${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? 's' : ''} · ${dateStr}`
    : `✅ Nith Ops weekly digest — ${dateStr}`

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
  <div style="background:#1e293b;padding:24px 28px;border-radius:8px 8px 0 0">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:700">Nith Ops Weekly Digest</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${dateStr}</p>
  </div>

  <!-- Stats bar -->
  <div style="background:#f8fafc;padding:20px 28px;display:flex;gap:24px;border-bottom:1px solid #e2e8f0">
    <div style="text-align:center">
      <div style="font-size:24px;font-weight:700;color:#1e293b">${activeSites.length}</div>
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Active Sites</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:24px;font-weight:700;color:${criticalAlerts.length > 0 ? '#dc2626' : '#16a34a'}">${criticalAlerts.length + warningAlerts.length}</div>
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Open Alerts</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:24px;font-weight:700;color:#1e293b">£${mrr.toFixed(0)}</div>
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">MRR</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:24px;font-weight:700;color:${overdueInvoices.length > 0 ? '#dc2626' : '#16a34a'}">${overdueInvoices.length}</div>
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Overdue</div>
    </div>
  </div>

  <!-- Site health -->
  <div style="padding:24px 28px">
    <h2 style="font-size:15px;font-weight:700;margin:0 0 12px;color:#1e293b">Site Health (7-day uptime)</h2>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Site</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">URL</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Uptime</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Status</th>
        </tr>
      </thead>
      <tbody>${siteRows}</tbody>
    </table>
  </div>

  ${alerts.length > 0 ? `
  <!-- Active alerts -->
  <div style="padding:0 28px 24px">
    <h2 style="font-size:15px;font-weight:700;margin:0 0 12px;color:#1e293b">Active Alerts (${alerts.length})</h2>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Severity</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Alert</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Site</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Date</th>
        </tr>
      </thead>
      <tbody>${alertRows}</tbody>
    </table>
  </div>` : ''}

  ${overdueInvoices.length > 0 ? `
  <!-- Overdue invoices -->
  <div style="padding:0 28px 24px">
    <h2 style="font-size:15px;font-weight:700;margin:0 0 12px;color:#dc2626">⚠ Overdue Invoices (${overdueInvoices.length})</h2>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #fca5a5;border-radius:6px;overflow:hidden">
      <thead>
        <tr style="background:#fff5f5">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Client</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Amount</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Month</th>
        </tr>
      </thead>
      <tbody>${overdueRows}</tbody>
    </table>
  </div>` : ''}

  ${pendingInvoices.length > 0 ? `
  <div style="padding:0 28px 24px">
    <p style="font-size:13px;color:#64748b;margin:0">
      💰 <strong>${pendingInvoices.length} pending invoice${pendingInvoices.length > 1 ? 's' : ''}</strong> —
      total £${pendingInvoices.reduce((s, i) => s + i.amount, 0).toFixed(0)} awaiting payment.
    </p>
  </div>` : ''}

  <!-- CTA -->
  <div style="padding:0 28px 28px">
    <a href="https://nith-ops.pages.dev" style="display:inline-block;background:#1e293b;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
      Open Nith Ops Dashboard →
    </a>
  </div>

  <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px">
    <p style="color:#94a3b8;font-size:11px;margin:0">Nith Ops weekly digest · <a href="https://nith-ops.pages.dev" style="color:#94a3b8">nith-ops.pages.dev</a></p>
  </div>
</div>`

  await sendEmail(alertEmail, subjectLine, html)

  return NextResponse.json({
    sent: true,
    activeSites: activeSites.length,
    openAlerts: alerts.length,
    overdueInvoices: overdueInvoices.length,
    mrr,
  })
}
