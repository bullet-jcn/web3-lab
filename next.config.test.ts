import { describe, expect, it } from 'vitest'
import nextConfig, { securityHeaders } from './next.config'
import { getRpcConnectSources } from './lib/rpc'

describe('security headers', () => {
  it('applies the security baseline to every route', async () => {
    const configured = await nextConfig.headers?.()

    expect(configured).toEqual([{ source: '/:path*', headers: securityHeaders }])
    expect(Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]))).toMatchObject({
      'Content-Security-Policy': expect.stringContaining("frame-ancestors 'none'"),
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    })
    const csp = Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]))[
      'Content-Security-Policy'
    ]
    for (const source of getRpcConnectSources()) {
      expect(csp).toContain(source)
    }
    expect(csp).not.toContain('/v2/')
    expect(csp).not.toContain('undefined')
  })
})
