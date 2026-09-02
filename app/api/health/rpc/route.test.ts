import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getRpcHealthReport: vi.fn() }))

vi.mock('@/lib/server/rpcHealth', () => ({
  getRpcHealthReport: mocks.getRpcHealthReport,
}))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RPC health route', () => {
  it.each([
    ['healthy', 200],
    ['degraded', 200],
    ['unhealthy', 503],
  ] as const)('maps %s health to HTTP %s', async (status, expectedStatus) => {
    mocks.getRpcHealthReport.mockResolvedValue({
      status,
      checkedAt: '2026-01-01T00:00:00.000Z',
      timeoutMs: 5_000,
      chains: [],
    })

    const response = await GET()

    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ status })
  })
})
