import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const repo = request.nextUrl.searchParams.get('repo')
  if (!repo) return NextResponse.json({ error: 'repo param required' }, { status: 400 })

  const token = process.env.GITHUB_TOKEN
  if (!token || token === 'placeholder_add_later') {
    return NextResponse.json({ configured: false, commits: [], prs: 0 })
  }

  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'nith-ops' }

  try {
    const [commitsRes, prsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`, {
        headers, signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.github.com/repos/${repo}/pulls?state=open`, {
        headers, signal: AbortSignal.timeout(8000),
      }),
    ])

    const [commits, prs] = await Promise.all([
      commitsRes.ok ? commitsRes.json() : [],
      prsRes.ok ? prsRes.json() : [],
    ])

    return NextResponse.json({
      configured: true,
      commits: Array.isArray(commits) ? commits : [],
      prs: Array.isArray(prs) ? prs.length : 0,
    })
  } catch {
    return NextResponse.json({ configured: true, commits: [], prs: 0 })
  }
}
