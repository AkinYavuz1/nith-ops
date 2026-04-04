import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST() {
  const cfToken = process.env.CLOUDFLARE_API_TOKEN
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const githubToken = process.env.GITHUB_TOKEN
  const githubUsername = process.env.GITHUB_USERNAME || 'AkinYavuz1'

  const results: Record<string, { ok: boolean; message: string }> = {}

  // Test Cloudflare
  if (cfToken && cfAccountId && cfToken !== 'placeholder_add_later') {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`,
        { headers: { Authorization: `Bearer ${cfToken}` }, signal: AbortSignal.timeout(8000) }
      )
      const json = await res.json()
      results.cloudflare = {
        ok: json.success,
        message: json.success
          ? `Connected — ${json.result?.length ?? 0} Pages projects`
          : json.errors?.[0]?.message || 'Authentication failed',
      }
    } catch {
      results.cloudflare = { ok: false, message: 'Connection timed out' }
    }
  } else {
    results.cloudflare = { ok: false, message: 'CLOUDFLARE_API_TOKEN not set in environment' }
  }

  // Test GitHub
  if (githubToken && githubToken !== 'placeholder_add_later') {
    try {
      const res = await fetch(
        `https://api.github.com/users/${githubUsername}/repos?per_page=1`,
        {
          headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'nith-ops' },
          signal: AbortSignal.timeout(8000),
        }
      )
      if (res.ok) {
        const remaining = res.headers.get('X-RateLimit-Remaining')
        results.github = { ok: true, message: `Connected — rate limit: ${remaining} remaining` }
      } else {
        results.github = { ok: false, message: 'Authentication failed' }
      }
    } catch {
      results.github = { ok: false, message: 'Connection timed out' }
    }
  } else {
    results.github = { ok: false, message: 'GITHUB_TOKEN not set in environment' }
  }

  return NextResponse.json(results)
}
