import { describe, expect, it } from 'vitest'
import { POST as verify } from './auth/verify/route'
import { POST as logout } from './auth/logout/route'
import { DELETE as removeWatchlist, POST as addWatchlist } from './watchlist/route'

function crossOriginRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: '{}',
  })
}

describe('state-changing API origin protection', () => {
  it.each([
    ['auth verify', () => verify(crossOriginRequest('/api/auth/verify'))],
    ['auth logout', () => logout(crossOriginRequest('/api/auth/logout'))],
    ['watchlist add', () => addWatchlist(crossOriginRequest('/api/watchlist'))],
    ['watchlist remove', () => removeWatchlist(crossOriginRequest('/api/watchlist'))],
  ])('rejects cross-origin %s before route work', async (_name, invoke) => {
    const response = await invoke()

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: '请求来源不受信任' })
  })
})
