import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'edge'

const TOPIC_TO_TYPE: Record<string, string> = {
  own: 'own',
  client: 'client',
  demo: 'demo',
}

interface GitHubRepo {
  full_name: string
  name: string
  description: string | null
  homepage: string | null
  topics: string[]
  language: string | null
  private: boolean
}

export async function POST(request: NextRequest) {
  // Simple auth — reuse the same session password
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.SYNC_SECRET || process.env.OPS_PASSWORD
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken || githubToken === 'placeholder_add_later') {
    return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 })
  }

  // Fetch all repos with topics
  const allRepos: GitHubRepo[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated&page=${page}`,
      { headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'nith-ops' } }
    )
    if (!res.ok) break
    const batch: GitHubRepo[] = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    allRepos.push(...batch)
    const link = res.headers.get('Link') || ''
    if (!link.includes('rel="next"')) break
    page++
  }

  // Only process repos that have a known dashboard topic
  const taggedRepos = allRepos.filter((r) =>
    r.topics.some((t) => Object.keys(TOPIC_TO_TYPE).includes(t))
  )

  // Get repos already in DB
  const { data: existingSites } = await supabase
    .from('ops_sites')
    .select('github_repo')
  const existingRepos = new Set(
    (existingSites || []).map((s: { github_repo?: string }) => s.github_repo).filter(Boolean)
  )

  // Find new repos not yet in DB
  const newRepos = taggedRepos.filter((r) => !existingRepos.has(r.full_name))

  if (newRepos.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No new repos to import' })
  }

  const imported: string[] = []
  const errors: string[] = []

  for (const repo of newRepos) {
    const topic = repo.topics.find((t) => Object.keys(TOPIC_TO_TYPE).includes(t))!
    const type = TOPIC_TO_TYPE[topic]

    const site = {
      name: repo.name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      url: repo.homepage || `https://github.com/${repo.full_name}`,
      github_repo: repo.full_name,
      type,
      status: 'development',
      platform: repo.language?.toLowerCase() || null,
      notes: repo.description || null,
    }

    const { error: insertError } = await supabase.from('ops_sites').insert(site)
    if (insertError) {
      errors.push(`${repo.full_name}: ${insertError.message}`)
      continue
    }

    // Log to activity feed
    await supabase.from('ops_activity').insert({
      type: 'deploy',
      title: `New repo detected: ${site.name}`,
      description: `Auto-imported from GitHub (${repo.full_name}) with type "${type}"`,
    })

    imported.push(repo.full_name)
  }

  return NextResponse.json({
    synced: imported.length,
    imported,
    errors: errors.length ? errors : undefined,
  })
}
