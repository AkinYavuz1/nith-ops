'use client'
export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, Download, Terminal } from 'lucide-react'
import Card from '@/components/Card'

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwResult, setPwResult] = useState<{ ok: boolean; message: string; command?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }> | null>(null)
  const [checkInterval, setCheckInterval] = useState('5')
  const [slowThreshold, setSlowThreshold] = useState('2000')
  const [timezone, setTimezone] = useState('Europe/London')
  const [autoScan, setAutoScan] = useState(true)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('ops_settings') || '{}')
    if (stored.checkInterval) setCheckInterval(stored.checkInterval)
    if (stored.slowThreshold) setSlowThreshold(stored.slowThreshold)
    if (stored.timezone) setTimezone(stored.timezone)
    if (stored.autoScan !== undefined) setAutoScan(stored.autoScan)
  }, [])

  function saveSettings() {
    localStorage.setItem('ops_settings', JSON.stringify({ checkInterval, slowThreshold, timezone, autoScan }))
    alert('Settings saved.')
  }

  async function testIntegrations() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/integrations/test', { method: 'POST' })
      setTestResult(res.ok ? await res.json() : null)
    } catch {
      setTestResult(null)
    }
    setTesting(false)
  }

  async function changePassword() {
    setPwResult(null)
    if (newPassword !== confirmPassword) { setPwResult({ ok: false, message: 'Passwords do not match' }); return }
    if (newPassword.length < 8) { setPwResult({ ok: false, message: 'Password must be at least 8 characters' }); return }
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const json = await res.json()
    if (json.instructions) {
      setPwResult({ ok: true, message: 'Run this command in your terminal to update the password:', command: json.message })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } else {
      setPwResult({ ok: false, message: json.error || 'Failed' })
    }
  }

  async function exportData() {
    const [sitesRes, alertsRes, activityRes, invoicesRes] = await Promise.all([
      fetch('/api/sites'), fetch('/api/alerts'), fetch('/api/activity'), fetch('/api/invoices'),
    ])
    const data = {
      sites: await sitesRes.json(),
      alerts: await alertsRes.json(),
      activity: await activityRes.json(),
      invoices: await invoicesRes.json(),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nith-ops-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-[#E4E7EC]">Settings</h1>

      {/* Integrations */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-1">Integrations</h2>
        <p className="text-xs text-[#9BA1B0] mb-4">
          Cloudflare and GitHub tokens are configured via environment variables on the server.
          Use <code className="bg-[#0F1117] px-1 rounded text-[#D4A84B]">wrangler pages secret put</code> to update them.
        </p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <code className="bg-[#0F1117] px-2 py-1 rounded text-[#9BA1B0] flex-1">CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID</code>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <code className="bg-[#0F1117] px-2 py-1 rounded text-[#9BA1B0] flex-1">GITHUB_TOKEN, GITHUB_USERNAME</code>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={testIntegrations}
            disabled={testing}
            className="flex items-center gap-2 text-sm bg-[#1A1D27] border border-[#2E3241] hover:border-[#3B4261] text-[#E4E7EC] px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            Test connections
          </button>
        </div>
        {testResult && (
          <div className="mt-3 space-y-2">
            {Object.entries(testResult).map(([key, val]) => (
              <div key={key} className={`flex items-center gap-2 text-sm ${val.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {val.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                <span className="capitalize font-medium">{key}:</span> {val.message}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Auto-discovery */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-4">Auto-Discovery</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setAutoScan(!autoScan)}
            className={`w-10 h-6 rounded-full transition-colors relative ${autoScan ? 'bg-[#D4A84B]' : 'bg-[#2E3241]'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoScan ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-[#E4E7EC]">Auto-scan on dashboard load</span>
        </label>
      </Card>

      {/* Monitoring */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-4">Monitoring</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Check interval (minutes)</label>
            <select
              value={checkInterval}
              onChange={(e) => setCheckInterval(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
            >
              {['1', '5', '10', '15', '30'].map((v) => <option key={v} value={v}>{v} min</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Slow threshold (ms)</label>
            <input
              type="number"
              value={slowThreshold}
              onChange={(e) => setSlowThreshold(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              min="500"
              step="100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
            >
              {['Europe/London', 'Europe/Paris', 'UTC', 'America/New_York', 'America/Los_Angeles'].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={saveSettings}
          className="mt-4 bg-[#D4A84B] hover:bg-[#c49535] text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Save settings
        </button>
      </Card>

      {/* Account */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-4">Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              placeholder="Current password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              placeholder="New password (min 8 chars)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              placeholder="Confirm new password"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={changePassword}
              disabled={!currentPassword || !newPassword || !confirmPassword}
              className="bg-[#1A1D27] border border-[#2E3241] hover:border-[#3B4261] disabled:opacity-50 text-[#E4E7EC] px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Change password
            </button>
            <button
              onClick={exportData}
              className="flex items-center gap-2 text-sm text-[#9BA1B0] hover:text-[#E4E7EC] transition-colors"
            >
              <Download className="w-4 h-4" />
              Export all data
            </button>
          </div>
          {pwResult && (
            <div className={`mt-2 ${pwResult.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'} text-sm`}>
              <div className="flex items-center gap-2">
                {pwResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                {pwResult.message}
              </div>
              {pwResult.command && (
                <div className="mt-2 bg-[#0F1117] rounded-lg p-3 flex items-start gap-2">
                  <Terminal className="w-4 h-4 text-[#D4A84B] flex-shrink-0 mt-0.5" />
                  <code className="text-xs text-[#9BA1B0] break-all">{pwResult.command}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
