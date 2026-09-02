import { describe, expect, it, vi } from 'vitest'
import { probeServiceReadiness } from './serviceHealth'

describe('service readiness', () => {
  it('requires PostgreSQL and Redis in postgres mode', async () => {
    const databaseCheck = vi.fn().mockResolvedValue(undefined)
    const redisCheck = vi.fn().mockResolvedValue(undefined)

    const report = await probeServiceReadiness({
      storageMode: () => 'postgres',
      databaseCheck,
      redisCheck,
      rpcCheck: async () => 'healthy',
      now: () => 1,
      checkedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    expect(report).toMatchObject({
      status: 'healthy',
      storageMode: 'postgres',
      checks: [
        { id: 'postgres', status: 'healthy' },
        { id: 'redis', status: 'healthy' },
        { id: 'rpc', status: 'healthy' },
      ],
    })
    expect(databaseCheck).toHaveBeenCalledOnce()
    expect(redisCheck).toHaveBeenCalledOnce()
  })

  it('does not probe persistence dependencies in explicit legacy mode', async () => {
    const databaseCheck = vi.fn()
    const redisCheck = vi.fn()
    const report = await probeServiceReadiness({
      storageMode: () => 'legacy-cookie',
      databaseCheck,
      redisCheck,
      rpcCheck: async () => 'healthy',
      now: () => 1,
    })

    expect(report.status).toBe('healthy')
    expect(report.checks).toEqual([
      { id: 'postgres', status: 'not_required' },
      { id: 'redis', status: 'not_required' },
      { id: 'rpc', status: 'healthy', latencyMs: 0 },
    ])
    expect(databaseCheck).not.toHaveBeenCalled()
    expect(redisCheck).not.toHaveBeenCalled()
  })

  it('reports dependency failure without returning an exception or error detail', async () => {
    const report = await probeServiceReadiness({
      storageMode: () => 'postgres',
      databaseCheck: async () => { throw new Error('postgresql://secret') },
      redisCheck: async () => undefined,
      rpcCheck: async () => 'degraded',
      now: () => 1,
    })

    expect(report.status).toBe('unhealthy')
    expect(report.checks).toContainEqual({ id: 'postgres', status: 'unhealthy', latencyMs: 0 })
    expect(report.checks).toContainEqual({ id: 'rpc', status: 'degraded', latencyMs: 0 })
    expect(JSON.stringify(report)).not.toContain('secret')
  })

  it('fails readiness when production storage mode is missing', async () => {
    const report = await probeServiceReadiness({
      storageMode: () => { throw new Error('missing production configuration') },
      now: () => 1,
    })

    expect(report).toMatchObject({
      status: 'unhealthy',
      checks: [{ id: 'configuration', status: 'unhealthy' }],
    })
    expect(report).not.toHaveProperty('storageMode')
  })
})
