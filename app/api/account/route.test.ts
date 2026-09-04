import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/accountDeletion'

const mocks = vi.hoisted(() => ({
  mode: 'postgres' as 'postgres' | 'legacy-cookie',
  getSession: vi.fn(),
  deleteUserData: vi.fn(),
  cookieDelete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ delete: mocks.cookieDelete }),
}))

vi.mock('@/lib/auth/session', () => ({
  SESSION_COOKIE_NAME: 'session',
  getSession: mocks.getSession,
}))

vi.mock('@/lib/auth/siwe', () => ({ NONCE_COOKIE_NAME: 'siwe-nonce' }))
vi.mock('@/lib/auth/watchlist', () => ({ WATCHLIST_COOKIE_NAME: 'watchlist' }))
vi.mock('@/lib/server/storageMode', () => ({
  readBackendStorageMode: () => mocks.mode,
}))
vi.mock('@/lib/server/backendServices', () => ({
  getBackendDataLifecycleRepository: async () => ({
    deleteUserData: mocks.deleteUserData,
  }),
}))

import { DELETE } from './route'

function request(origin = 'http://localhost', confirmation = ACCOUNT_DELETION_CONFIRMATION) {
  return new Request('http://localhost/api/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ confirmation }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mode = 'postgres'
  mocks.getSession.mockResolvedValue({
    address: '0x1234567890123456789012345678901234567890',
    chainId: 11_155_111,
    userId: 'user-1',
    walletId: 'wallet-1',
  })
  mocks.deleteUserData.mockResolvedValue(true)
})

describe('account deletion route', () => {
  it('deletes all service data before clearing every service cookie', async () => {
    const response = await DELETE(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: true, onchainDataUnaffected: true })
    expect(mocks.deleteUserData).toHaveBeenCalledWith('user-1')
    expect(mocks.cookieDelete).toHaveBeenCalledTimes(3)
    expect(mocks.cookieDelete).toHaveBeenCalledWith({ name: 'session', path: '/api' })
  })

  it('rejects cross-origin and unconfirmed deletion attempts before accessing data', async () => {
    const crossOrigin = await DELETE(request('https://evil.example'))
    const unconfirmed = await DELETE(request('http://localhost', 'delete'))

    expect(crossOrigin.status).toBe(403)
    expect(unconfirmed.status).toBe(400)
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.deleteUserData).not.toHaveBeenCalled()
  })

  it('requires an authenticated durable session', async () => {
    mocks.getSession.mockResolvedValue(null)
    expect((await DELETE(request())).status).toBe(401)

    mocks.mode = 'legacy-cookie'
    expect((await DELETE(request())).status).toBe(503)
    expect(mocks.deleteUserData).not.toHaveBeenCalled()
  })

  it('keeps cookies when durable deletion fails', async () => {
    mocks.deleteUserData.mockRejectedValue(new Error('database unavailable'))

    const response = await DELETE(request())

    expect(response.status).toBe(503)
    expect(mocks.cookieDelete).not.toHaveBeenCalled()
  })
})
