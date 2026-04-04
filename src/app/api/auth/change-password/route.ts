import { NextRequest, NextResponse } from 'next/server'
import { checkPassword } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const { currentPassword, newPassword } = await request.json()

  if (!checkPassword(currentPassword)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  // On Cloudflare Pages, env vars are set at deploy time via wrangler secrets.
  // We can't update them at runtime — instruct the user to rotate via wrangler.
  return NextResponse.json({
    instructions: true,
    message: `Run this command to update your password:\n\necho "${newPassword}" | npx wrangler pages secret put OPS_PASSWORD --project-name nith-ops`,
  })
}
