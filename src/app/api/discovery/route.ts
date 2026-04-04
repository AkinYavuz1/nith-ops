import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  language: string | null
  updated_at: string
  html_url: string
  homepage: string | null
}

interface CloudflareProject {
  name: string
  subdomain: string
  domains: string[]
  latest_deployment?: { created_on: string }
}

export async function GET() {
  const githubToken = process.env.GITHUB_TOKEN
  const githubUsername = process.env.GITHUB_USERNAME || 'AkinYavuz1'
  const cfToken = process.env.CLOUDFLARE_API_TOKEN
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

  const isGitHubConfigured = githubToken && githubToken !== 'placeholder_add_later'
  const isCFConfigured = cfToken && cfToken !== 'placeholder_add_later' && cfAccountId && cfAccountId !== 'placeholder_add_later'

  const { data: sites } = await supabase.from('ops_sites').select('github_repo, url, name')
  const existingRepos = new Set((sites || []).map((s: { github_repo?: string }) => s.github_repo).filter(Boolean))
  const existingUrls = new Set((sites || []).map((s: { url: string }) => s.url))

  const result = {
    github: { configured: isGitHubConfigured, repos: [] as GitHubRepo[] },
    cloudflare: { configured: isCFConfigured, projects: [] as CloudflareProject[] },
  }

  if (isGitHubConfigured) {
    try {
      const res = await fetch(
        `https://api.github.com/users/${githubUsername}/repos?per_page=100&sort=updated`,
        { headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'nith-ops' } }
      )
      const repos: GitHubRepo[] = await res.json()
      result.github.repos = repos.filter(
        (r) => !existingRepos.has(r.full_name) && !existingRepos.has(`${githubUsername}/${r.name}`)
      )
    } catch { /* ignore */ }
  }

  if (isCFConfigured) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`,
        { headers: { Authorization: `Bearer ${cfToken}` } }
      )
      const json = await res.json()
      const projects: CloudflareProject[] = json.result || []
      result.cloudflare.projects = projects.filter((p) => {
        const url = `https://${p.subdomain}.pages.dev`
        return !existingUrls.has(url) && !(p.domains || []).some((d: string) => existingUrls.has(`https://${d}`))
      })
    } catch { /* ignore */ }
  }

  return NextResponse.json(result)
}
