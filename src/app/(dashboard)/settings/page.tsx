'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, Download, Eye, EyeOff } from 'lucide-react'
import Card from '@/components/Card'

export default function SettingsPage() {
  const [cfToken, setCfToken] = useState('')
  const [cfAccount, setCfAccount] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [ghUsername, setGhUsername] = useState('AkinYavuz1')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCf, setShowCf] = useState(false)
  const [showGh, setShowGh] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [checkInterval, setCheckInterval] = useState('5')
  const [slowThreshold, setSlowThreshold] = useState('2000')
  const [timezone, setTimezone] = useState('Europe/London')
  const [autoScan, setAutoScan] = useState(true)

  // Load settings from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('ops_settings') || '{}')
    if (stored.checkInterval) setCheckInterval(stored.checkInterval)
    if (stored.slowThreshold) setSlowThreshold(stored.slowThreshold)
    if (stored.timezone) setTimezone(stored.timezone)
    if (stored.autoScan !== undefined) setAutoScan(stored.autoScan)
    if (stored.ghUsername) setGhUsername(stored.ghUsername)
  }, [])

  function saveSettings() {
    localStorage.setItem('ops_settings', JSON.stringify({
      checkInterval, slowThreshold, timezone, autoScan, ghUsername,
    }))
    alert('Settings saved.')
  }

  async function testCloudflare() {
    setTesting('cf')
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      })
      const json = await res.json()
      setTestResult((prev) => ({
        ...prev,
        cf: { ok: json.success, message: json.success ? `Found ${json.result?.length || 0} Pages projects` : json.errors?.[0]?.message || 'Connection failed' },
      }))
    } catch {
      setTestResult((prev) => ({ ...prev, cf: { ok: false, message: 'Connection failed' } }))
    }
    setTesting(null)
  }

  async function testGitHub() {
    setTesting('gh')
    try {
      const res = await fetch(`https://api.github.com/users/${ghUsername}/repos?per_page=1`, {
        headers: { Authorization: `Bearer ${ghToken}` },
      })
      if (res.ok) {
        const remaining = res.headers.get('X-RateLimit-Remaining')
        setTestResult((prev) => ({ ...prev, gh: { ok: true, message: `Connected. Rate limit: ${remaining} remaining` } }))
      } else {
        setTestResult((prev) => ({ ...prev, gh: { ok: false, message: 'Authentication failed' } }))
      }
    } catch {
      setTestResult((prev) => ({ ...prev, gh: { ok: false, message: 'Connection failed' } }))
    }
    setTesting(null)
  }

  async function exportData() {
    const [sitesRes, alertsRes, activityRes, invoicesRes] = await Promise.all([
      fetch('/api/sites'),
      fetch('/api/alerts'),
      fetch('/api/activity'),
      fetch('/api/invoices'),
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

  async function changePassword() {
    if (newPassword !== confirmPassword) { alert('Passwords do not match.'); return }
    if (newPassword.length < 8) { alert('Password must be at least 8 characters.'); return }
    alert('To change the password, update OPS_PASSWORD in .env.local and redeploy.')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-[#E4E7EC]">Settings</h1>

      {/* Cloudflare */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-4">Cloudflare Integration</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Account ID</label>
            <input
              value={cfAccount}
              onChange={(e) => setCfAccount(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              placeholder="Add CLOUDFLARE_ACCOUNT_ID to .env.local"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">API Token</label>
            <div className="relative">
              <input
                type={showCf ? 'text' : 'password'}
                value={cfToken}
                onChange={(e) => setCfToken(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 pr-10 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="Add CLOUDFLARE_API_TOKEN to .env.local"
              />
              <button onClick={() => setShowCf(!showCf)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA1B0] hover:text-[#E4E7EC]">
                {showCf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={testCloudflare}
              disabled={testing === 'cf' || !cfToken || !cfAccount}
              className="flex items-center gap-2 text-sm bg-[#1A1D27] border border-[#2E3241] hover:border-[#3B4261] text-[#E4E7EC] px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {testing === 'cf' ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Test connection
            </button>
            {testResult.cf && (
              <div className={`flex items-center gap-1 text-sm ${testResult.cf.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {testResult.cf.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {testResult.cf.message}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* GitHub */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-4">GitHub Integration</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">GitHub Username</label>
            <input
              value={ghUsername}
              onChange={(e) => setGhUsername(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              placeholder="AkinYavuz1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Personal Access Token</label>
            <div className="relative">
              <input
                type={showGh ? 'text' : 'password'}
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 pr-10 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
                placeholder="Add GITHUB_TOKEN to .env.local"
              />
              <button onClick={() => setShowGh(!showGh)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA1B0] hover:text-[#E4E7EC]">
                {showGh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={testGitHub}
              disabled={testing === 'gh' || !ghToken}
              className="flex items-center gap-2 text-sm bg-[#1A1D27] border border-[#2E3241] hover:border-[#3B4261] text-[#E4E7EC] px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {testing === 'gh' ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Test connection
            </button>
            {testResult.gh && (
              <div className={`flex items-center gap-1 text-sm ${testResult.gh.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {testResult.gh.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {testResult.gh.message}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Auto-discovery */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-4">Auto-Discovery</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setAutoScan(!autoScan)}
              className={`w-10 h-6 rounded-full transition-colors relative ${autoScan ? 'bg-[#D4A84B]' : 'bg-[#2E3241]'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoScan ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-[#E4E7EC]">Auto-scan on dashboard load</span>
          </label>
        </div>
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
        <h2 className="text-sm font-semibold text-[#E4E7EC] mb-4">Account</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              placeholder="New password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9BA1B0] mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg px-3 py-2 text-sm text-[#E4E7EC] focus:outline-none focus:border-[#3B4261]"
              placeholder="Confirm password"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={changePassword}
              disabled={!newPassword || !confirmPassword}
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
        </div>
      </Card>
    </div>
  )
}
