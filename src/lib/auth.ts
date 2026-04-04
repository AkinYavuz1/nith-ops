const AUTH_COOKIE = 'ops_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function getAuthCookieName() {
  return AUTH_COOKIE
}

export function getSessionMaxAge() {
  return SESSION_MAX_AGE
}

export function checkPassword(password: string): boolean {
  const correctPassword = process.env.OPS_PASSWORD || 'nithdigital2026'
  return password === correctPassword
}
