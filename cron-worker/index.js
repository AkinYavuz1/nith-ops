export default {
  async scheduled(event, env, _ctx) {
    const base = env.DASHBOARD_URL
    const secret = env.CRON_SECRET
    const auth = { Authorization: `Bearer ${env.OPS_PASSWORD}` }

    // ── Uptime check (every hour) ─────────────────────────────────────────────
    try {
      const uptimeRes = await fetch(`${base}/api/cron/uptime-check?secret=${secret}`)
      const uptimeBody = await uptimeRes.json()
      console.log('Uptime check result:', JSON.stringify(uptimeBody))
    } catch (err) {
      console.error('Uptime check failed:', err)
    }

    // ── GitHub sync (every hour) ──────────────────────────────────────────────
    try {
      const syncRes = await fetch(`${base}/api/sync-github`, { method: 'POST', headers: auth })
      const syncBody = await syncRes.json()
      console.log('GitHub sync result:', JSON.stringify(syncBody))
    } catch (err) {
      console.error('GitHub sync failed:', err)
    }

    // ── SSL check (once per day — only run at 07:00 UTC) ──────────────────────
    const hour = new Date().getUTCHours()
    if (hour === 7) {
      try {
        const sslRes = await fetch(`${base}/api/cron/ssl-check?secret=${secret}`)
        const sslBody = await sslRes.json()
        console.log('SSL check result:', JSON.stringify(sslBody))
      } catch (err) {
        console.error('SSL check failed:', err)
      }
    }

    // ── Weekly digest (Monday at 08:00 UTC) ───────────────────────────────────
    const day = new Date().getUTCDay() // 0=Sun, 1=Mon
    if (day === 1 && hour === 8) {
      try {
        const digestRes = await fetch(`${base}/api/cron/weekly-digest?secret=${secret}`)
        const digestBody = await digestRes.json()
        console.log('Weekly digest result:', JSON.stringify(digestBody))
      } catch (err) {
        console.error('Weekly digest failed:', err)
      }
    }

    // ── Monthly invoice generation (1st of month at 09:00 UTC) ───────────────
    const date = new Date().getUTCDate()
    if (date === 1 && hour === 9) {
      try {
        const invoiceRes = await fetch(`${base}/api/cron/generate-invoices?secret=${secret}`)
        const invoiceBody = await invoiceRes.json()
        console.log('Invoice generation result:', JSON.stringify(invoiceBody))
      } catch (err) {
        console.error('Invoice generation failed:', err)
      }
    }

    // ── Monthly GSC sitemap re-submission (1st of month at 10:00 UTC) ─────────
    if (date === 1 && hour === 10) {
      try {
        const gscRes = await fetch(`${base}/api/cron/gsc-submit?secret=${secret}`)
        const gscBody = await gscRes.json()
        console.log('GSC sitemap submission result:', JSON.stringify(gscBody))
      } catch (err) {
        console.error('GSC sitemap submission failed:', err)
      }
    }
  },
}
