import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getServiceReadinessReport: vi.fn() }))

vi.mock('@/lib/server/serviceHealth', () => ({
  getServiceReadinessReport: mocks.getServiceReadinessReport,
}))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('service readiness route', () => {
  it.each([
    ['healthy', 200],
    ['degraded', 200],
    ['unhealthy', 503],
  ] as const)('maps %s readiness to HTTP %s', async (status, expectedStatus) => {
    mocks.getServiceReadinessReport.mockResolvedValue({
      status,
      checkedAt: '2026-01-01T00:00:00.000Z',
      storageMode: 'postgres',
      timeoutMs: 6_000,
      checks: [],
    })

    const response = await GET()

    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(await response.json()).toMatchObject({ status })
  })
})
