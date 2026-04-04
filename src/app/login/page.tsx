'use client'
export const runtime = 'edge'


import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
    } else {
      setError('Incorrect password. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#D4A84B] text-black text-2xl font-bold mb-4">
            N
          </div>
          <h1 className="text-2xl font-bold text-[#E4E7EC]">Nith Ops</h1>
          <p className="text-[#9BA1B0] mt-1 text-sm">Operations Dashboard</p>
        </div>

        <div className="bg-[#1A1D27] border border-[#2E3241] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#9BA1B0] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9BA1B0]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2E3241] rounded-lg pl-10 pr-4 py-3 text-[#E4E7EC] placeholder-[#9BA1B0] focus:outline-none focus:border-[#D4A84B] transition-colors"
                  placeholder="Enter ops password"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <p className="text-[#EF4444] text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#D4A84B] hover:bg-[#c49535] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#9BA1B0] text-xs mt-6">
          Private — Nith Digital internal use only
        </p>
      </div>
    </div>
  )
}
