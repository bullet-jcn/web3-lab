import { describe, expect, it, vi } from 'vitest'
import { observeRoute } from './route'

describe('observeRoute', () => {
  it('adds correlation and timing evidence without reading request payloads', async () => {
    const writer = vi.fn()
    const handler = observeRoute(
      { route: '/api/watchlist', method: 'POST', dependency: 'postgres' },
      async (request: Request) => {
        void request.method
        return Response.json({ ok: true })
      },
      {
        now: (() => {
          const values = [10, 22.34]
          return () => values.shift()!
        })(),
        randomUUID: () => 'request-safe-id',
        writer,
      },
    )

    const response = await handler(new Request('https://example.com/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ address: '0xprivate-in-log-context' }),
    }))

    expect(response.headers.get('x-request-id')).toBe('request-safe-id')
    expect(response.headers.get('server-timing')).toBe('app;dur=12.3')
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      event: 'http.request.completed',
      request_id: 'request-safe-id',
      status_code: 200,
      duration_ms: 12.3,
    }))
    expect(JSON.stringify(writer.mock.calls)).not.toContain('0xprivate-in-log-context')
  })

  it('records mapped dependency failures as server errors', async () => {
    const writer = vi.fn()
    const handler = observeRoute(
      { route: '/api/auth/session', method: 'GET', dependency: 'postgres' },
      async () => Response.json({ error: 'unavailable' }, { status: 503 }),
      { now: () => 1, randomUUID: () => 'request-2', writer },
    )

    await handler()

    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      outcome: 'server_error',
      dependency: 'postgres',
      status_code: 503,
    }))
  })

  it('records unhandled failures and preserves the exception', async () => {
    const writer = vi.fn()
    const error = new Error('secret upstream response')
    const handler = observeRoute(
      { route: '/api/health/rpc', method: 'GET', dependency: 'rpc' },
      async () => { throw error },
      { now: () => 1, randomUUID: () => 'request-3', writer },
    )

    await expect(handler()).rejects.toBe(error)
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      status_code: 500,
      dependency: 'rpc',
    }))
    expect(JSON.stringify(writer.mock.calls)).not.toContain('secret upstream response')
  })
})
