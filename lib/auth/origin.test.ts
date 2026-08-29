import { describe, expect, it } from 'vitest'
import { validateRequestOrigin } from './origin'

function request(origin?: string, headers: Record<string, string> = {}) {
  return new Request('https://sentinel.example/api/watchlist', {
    method: 'POST',
    headers: { ...(origin ? { Origin: origin } : {}), ...headers },
  })
}

describe('validateRequestOrigin', () => {
  it('accepts the exact request origin', () => {
    expect(validateRequestOrigin(request('https://sentinel.example'), { appOrigin: '' })).toEqual({ ok: true })
  })

  it.each([undefined, 'null', 'https://evil.example', 'javascript:alert(1)'])(
    'rejects a missing or untrusted origin: %s',
    (origin) => {
      expect(validateRequestOrigin(request(origin), { appOrigin: 'https://sentinel.example' })).toEqual({
        ok: false,
        status: 403,
        error: expect.stringContaining('请求来源'),
      })
    },
  )

  it('uses an explicit application origin instead of the internal request URL', () => {
    const internalRequest = new Request('http://internal:3000/api/watchlist', {
      method: 'POST',
      headers: { Origin: 'https://sentinel.example' },
    })

    expect(validateRequestOrigin(internalRequest, { appOrigin: 'https://sentinel.example' })).toEqual({ ok: true })
  })

  it('ignores spoofed forwarded headers unless proxy trust is explicitly enabled', () => {
    const proxiedRequest = new Request('http://internal:3000/api/watchlist', {
      method: 'POST',
      headers: {
        Origin: 'https://sentinel.example',
        'X-Forwarded-Host': 'sentinel.example',
        'X-Forwarded-Proto': 'https',
      },
    })

    expect(validateRequestOrigin(proxiedRequest, { appOrigin: '', trustProxyHeaders: false }).ok).toBe(false)
    expect(validateRequestOrigin(proxiedRequest, { appOrigin: '', trustProxyHeaders: true })).toEqual({ ok: true })
  })

  it('fails closed when the configured application origin is invalid', () => {
    expect(validateRequestOrigin(request('https://sentinel.example'), { appOrigin: 'not a URL' })).toEqual({
      ok: false,
      status: 500,
      error: '服务端 Origin 配置无效',
    })
  })
})
