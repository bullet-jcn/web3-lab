import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const cookieValues = new Map<string, string>([['siwe-nonce', 'nonce-value']])
  return {
    cookieValues,
    cookieSet: vi.fn(),
    cookieDelete: vi.fn(),
    issue: vi.fn(),
    consume: vi.fn(),
    createBackendSession: vi.fn(),
    revoke: vi.fn(),
    getSession: vi.fn(),
    verifyWithNonce: vi.fn(),
  }
})

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues.get(name)
      return value ? { name, value } : undefined
    },
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  }),
}))

vi.mock('@/lib/server/storageMode', () => ({ readBackendStorageMode: () => 'postgres' }))

vi.mock('@/lib/server/backendServices', () => ({
  getBackendNonceService: async () => ({ issue: mocks.issue, consume: mocks.consume }),
  getBackendSessionService: async () => ({
    create: mocks.createBackendSession,
    revoke: mocks.revoke,
  }),
}))

vi.mock('@/lib/auth/session', () => ({
  SESSION_COOKIE_NAME: 'session',
  SESSION_TTL_SECONDS: 604800,
  createSession: vi.fn(),
  getSession: mocks.getSession,
}))

vi.mock('@/lib/auth/siwe', () => ({
  NONCE_COOKIE_NAME: 'siwe-nonce',
  NONCE_TTL_SECONDS: 300,
  verifySignIn: vi.fn(),
  verifySignInWithNonce: mocks.verifyWithNonce,
}))

import { GET as issueNonce } from './auth/nonce/route'
import { POST as verify } from './auth/verify/route'
import { GET as readSession } from './auth/session/route'
import { POST as logout } from './auth/logout/route'

function sameOriginPost(path: string, body = '{}') {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cookieValues.clear()
  mocks.cookieValues.set('siwe-nonce', 'nonce-value')
  mocks.issue.mockResolvedValue('issued-nonce')
  mocks.consume.mockResolvedValue(true)
  mocks.verifyWithNonce.mockResolvedValue({
    ok: true,
    address: '0x1234567890123456789012345678901234567890',
    chainId: 11_155_111,
  })
  mocks.createBackendSession.mockResolvedValue({ token: 's'.repeat(43), session: {} })
  mocks.revoke.mockResolvedValue(true)
})

describe('PostgreSQL/Redis auth routes', () => {
  it('issues a Redis-backed nonce and stores only the nonce cookie', async () => {
    const response = await issueNonce()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ nonce: 'issued-nonce' })
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'siwe-nonce',
      'issued-nonce',
      expect.objectContaining({ httpOnly: true, maxAge: 300 }),
    )
  })

  it('consumes the verified nonce before creating an opaque backend session', async () => {
    const response = await verify(
      sameOriginPost('/api/auth/verify', JSON.stringify({ message: 'message', signature: '0x12' })),
    )

    expect(response.status).toBe(200)
    expect(mocks.verifyWithNonce).toHaveBeenCalledWith(
      'message',
      '0x12',
      'nonce-value',
      'http://localhost',
    )
    expect(mocks.consume).toHaveBeenCalledWith('nonce-value')
    expect(mocks.createBackendSession).toHaveBeenCalled()
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'session',
      's'.repeat(43),
      expect.objectContaining({ httpOnly: true, maxAge: 604800 }),
    )
  })

  it('rejects a replay when the nonce was already consumed', async () => {
    mocks.consume.mockResolvedValue(false)

    const response = await verify(
      sameOriginPost('/api/auth/verify', JSON.stringify({ message: 'message', signature: '0x12' })),
    )

    expect(response.status).toBe(401)
    expect(mocks.createBackendSession).not.toHaveBeenCalled()
  })

  it('returns only the public session fields', async () => {
    mocks.getSession.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      chainId: 11_155_111,
      userId: 'private-user-id',
      walletId: 'private-wallet-id',
    })

    const response = await readSession()
    expect(await response.json()).toEqual({
      address: '0x1234567890123456789012345678901234567890',
      chainId: 11_155_111,
    })
  })

  it('durably revokes the token before deleting its cookie', async () => {
    mocks.cookieValues.set('session', 's'.repeat(43))
    const response = await logout(sameOriginPost('/api/auth/logout'))

    expect(response.status).toBe(200)
    expect(mocks.revoke).toHaveBeenCalledWith('s'.repeat(43))
    expect(mocks.cookieDelete).toHaveBeenCalledWith({ name: 'session', path: '/api' })
  })

  it('keeps the cookie when durable revocation is unavailable', async () => {
    mocks.cookieValues.set('session', 's'.repeat(43))
    mocks.revoke.mockRejectedValue(new Error('database unavailable'))

    const response = await logout(sameOriginPost('/api/auth/logout'))

    expect(response.status).toBe(503)
    expect(mocks.cookieDelete).not.toHaveBeenCalled()
  })
})
