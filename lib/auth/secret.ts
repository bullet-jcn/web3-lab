export function getAuthSecret(): string {
  const secret = process.env.AUTH_COOKIE_SECRET
  if (!secret) throw new Error('AUTH_COOKIE_SECRET is not set')
  return secret
}
