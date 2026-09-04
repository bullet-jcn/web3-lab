import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildStructuredLog } from './logger'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('structured observability log', () => {
  it('keeps only bounded operational fields', () => {
    const secret = 'session-token-and-wallet-0x123456'
    const error = new TypeError(secret)
    error.stack = `TypeError: ${secret}\n at secret-function`

    const record = buildStructuredLog({
      level: 'error',
      event: 'http.request.completed',
      requestId: 'request-123',
      route: '/api/watchlist',
      method: 'post',
      statusCode: 503,
      durationMs: 12.345,
      outcome: 'server_error',
      dependency: 'postgres',
      error,
    }, new Date('2026-01-02T03:04:05.000Z'))

    expect(record).toMatchObject({
      timestamp: '2026-01-02T03:04:05.000Z',
      event: 'http.request.completed',
      request_id: 'request-123',
      route: '/api/watchlist',
      method: 'POST',
      status_code: 503,
      duration_ms: 12.3,
      outcome: 'server_error',
      dependency: 'postgres',
      error_type: 'TypeError',
    })
    expect(JSON.stringify(record)).not.toContain(secret)
    expect(record).not.toHaveProperty('message')
    expect(record).not.toHaveProperty('stack')
  })

  it('drops tokens that could create unbounded or injected dimensions', () => {
    const record = buildStructuredLog({
      level: 'warn',
      event: 'next.request.error',
      requestId: 'bad id with spaces',
      route: '/api/watchlist?address=0xsecret',
      method: 'GET\nforged',
      providerId: 'provider key=value',
      errorDigest: 'x'.repeat(129),
    })

    expect(record).not.toHaveProperty('request_id')
    expect(record).not.toHaveProperty('route')
    expect(record).not.toHaveProperty('method')
    expect(record).not.toHaveProperty('provider_id')
    expect(record).not.toHaveProperty('error_digest')
  })

  it('correlates deployed logs with a bounded environment and release', () => {
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'staging')
    vi.stubEnv('RELEASE_ID', 'a'.repeat(40))

    expect(buildStructuredLog({
      level: 'info',
      event: 'service.readiness',
      outcome: 'success',
    })).toMatchObject({
      environment: 'staging',
      release_id: 'a'.repeat(40),
    })
  })
})
