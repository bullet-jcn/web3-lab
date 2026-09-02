import { beforeEach, describe, expect, it, vi } from 'vitest'

const owner = '0x1234567890123456789012345678901234567890'
const target = '0x1111111111111111111111111111111111111111'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  list: vi.fn(),
  addWithLimit: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSession: mocks.getSession }))
vi.mock('@/lib/server/storageMode', () => ({ readBackendStorageMode: () => 'postgres' }))
vi.mock('@/lib/server/backendServices', () => ({
  getBackendWatchlistRepository: async () => ({
    list: mocks.list,
    addWithLimit: mocks.addWithLimit,
    remove: mocks.remove,
  }),
}))

import { DELETE, GET, POST } from './watchlist/route'

function mutationRequest(method: 'POST' | 'DELETE') {
  return new Request('http://localhost/api/watchlist', {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify({ address: target }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({
    address: owner,
    chainId: 11_155_111,
    userId: 'user-id',
    walletId: 'wallet-id',
  })
  mocks.list.mockResolvedValue([{ address: target }])
  mocks.addWithLimit.mockResolvedValue({ status: 'added', entry: { address: target } })
  mocks.remove.mockResolvedValue(true)
})

describe('PostgreSQL watchlist route', () => {
  it('reads the authenticated user and chain scoped list', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ addresses: [target] })
    expect(mocks.list).toHaveBeenCalledWith('user-id', 11_155_111)
  })

  it('adds through the concurrency-safe 20-entry boundary', async () => {
    const response = await POST(mutationRequest('POST'))

    expect(response.status).toBe(200)
    expect(mocks.addWithLimit).toHaveBeenCalledWith(
      'user-id',
      11_155_111,
      target,
      null,
      20,
    )
  })

  it.each([
    ['duplicate', '地址已存在'],
    ['full', '最多只能关注 20 个地址'],
  ])('maps the %s mutation result without a second insert', async (status, message) => {
    mocks.addWithLimit.mockResolvedValue({ status })

    const response = await POST(mutationRequest('POST'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: message })
  })

  it('removes and then returns the current durable list', async () => {
    mocks.list.mockResolvedValue([])
    const response = await DELETE(mutationRequest('DELETE'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ addresses: [] })
    expect(mocks.remove).toHaveBeenCalledWith('user-id', 11_155_111, target)
  })

  it('returns 503 instead of treating a database outage as an empty list', async () => {
    mocks.list.mockRejectedValue(new Error('database unavailable'))

    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: '数据服务暂时不可用' })
  })
})
