import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, getAuthCookieName, getSessionMaxAge } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(getAuthCookieName(), 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: getSessionMaxAge(),
    path: '/',
  })

  return response
}
