import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

// Auto-generates monthly invoices for all active client sites with monthly_fee > 0.
// Call on 1st of each month: GET /api/cron/generate-invoices?secret=YOUR_CRON_SECRET
// Skips if an invoice already exists for this site + month (idempotent).
// Sends a summary email listing what was generated.

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Nith Ops <billing@nithdigital.uk>', to, subject, html }),
  })
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const alertEmail = process.env.ALERT_EMAIL || 'akin@nithdigital.uk'

  // Current month in YYYY-MM format
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Get all active client sites with a monthly fee
  const { data: sites } = await supabase
    .from('ops_sites')
    .select('id, name, client_name, client_email, monthly_fee')
    .eq('status', 'active')
    .eq('type', 'client')
    .gt('monthly_fee', 0)

  if (!sites?.length) return NextResponse.json({ generated: 0, month })

  // Get existing invoices for this month to avoid duplicates
  const { data: existing } = await supabase
    .from('ops_invoices')
    .select('site_id')
    .eq('month', month)

  const alreadyInvoicedIds = new Set((existing ?? []).map((i: { site_id: string }) => i.site_id))

  const toCreate = sites.filter(s => !alreadyInvoicedIds.has(s.id))
  if (!toCreate.length) return NextResponse.json({ generated: 0, month, message: 'All invoices already exist for this month' })

  // Create invoices
  const inserts = toCreate.map(site => ({
    site_id: site.id,
    month,
    amount: site.monthly_fee,
    status: 'pending',
  }))

  const { data: created, error } = await supabase
    .from('ops_invoices')
    .insert(inserts)
    .select('id, site_id, amount')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log to activity
  await Promise.all(
    toCreate.map(site =>
      supabase.from('ops_activity').insert({
        site_id: site.id,
        type: 'invoice',
        title: `Invoice auto-generated — ${site.client_name || site.name}`,
        description: `£${site.monthly_fee} · ${month}`,
      })
    )
  )

  const totalAmount = toCreate.reduce((sum, s) => sum + s.monthly_fee, 0)

  // Summary email
  const rows = toCreate.map(site =>
    `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-size:13px">${site.client_name || site.name}</td>
      <td style="padding:8px 12px;font-size:13px">£${site.monthly_fee}</td>
      <td style="padding:8px 12px;font-size:13px;color:#64748b">${month}</td>
    </tr>`
  ).join('')

  await sendEmail(
    alertEmail,
    `💰 ${toCreate.length} invoice${toCreate.length > 1 ? 's' : ''} generated — ${month} (£${totalAmount})`,
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#1e293b">
  <h2 style="font-size:18px;font-weight:700;margin:0 0 4px">Monthly invoices generated</h2>
  <p style="color:#64748b;font-size:13px;margin:0 0 20px">${month} · ${toCreate.length} invoice${toCreate.length > 1 ? 's' : ''} · Total: <strong>£${totalAmount}</strong></p>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
    <thead>
      <tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Client</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Amount</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Month</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:20px">
    <a href="https://nith-ops.pages.dev/billing" style="background:#1e293b;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
      View Billing Dashboard →
    </a>
  </p>
  <p style="color:#94a3b8;font-size:11px;margin-top:24px">Nith Ops auto-billing · <a href="https://nith-ops.pages.dev" style="color:#94a3b8">nith-ops.pages.dev</a></p>
</div>`
  )

  return NextResponse.json({ generated: toCreate.length, month, total: totalAmount, created })
}
