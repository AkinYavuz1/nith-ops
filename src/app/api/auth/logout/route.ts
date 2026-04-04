import { NextResponse } from 'next/server'
import { getAuthCookieName } from '@/lib/auth'

export const runtime = 'edge'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(getAuthCookieName())
  return response
}
