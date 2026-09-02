import { describe, expect, it, vi } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import type { RpcProviderDefinition } from '@/lib/rpc'
import { probeRpcHealth, probeRpcProvider } from './rpcHealth'

const provider: RpcProviderDefinition = {
  id: 'provider',
  name: 'Provider',
  url: 'https://secret-key.example/rpc',
}

describe('probeRpcProvider', () => {
  it('returns public health evidence without exposing the provider URL', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ jsonrpc: '2.0', id: 1, result: '0x2a' }),
    )

    const result = await probeRpcProvider(provider, { fetchFn, now: () => 10 })

    expect(result).toEqual({
      id: 'provider',
      name: 'Provider',
      status: 'healthy',
      latencyMs: 0,
      blockNumber: '42',
    })
    expect(JSON.stringify(result)).not.toContain(provider.url)
  })

  it.each([
    new Response('upstream error', { status: 503 }),
    Response.json({ jsonrpc: '2.0', id: 1, result: 'not-hex' }),
    Response.json({ jsonrpc: '2.0', id: 1, error: { message: 'secret upstream detail' } }),
  ])('maps invalid upstream evidence to a redacted unhealthy result', async (response) => {
    const result = await probeRpcProvider(provider, {
      fetchFn: vi.fn<typeof fetch>().mockResolvedValue(response),
      now: () => 10,
    })

    expect(result).toEqual({
      id: 'provider',
      name: 'Provider',
      status: 'unhealthy',
      latencyMs: 0,
    })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('aborts a provider probe at the configured timeout', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn<typeof fetch>().mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }),
    )

    try {
      const resultPromise = probeRpcProvider(provider, { fetchFn, timeoutMs: 100 })
      await vi.advanceTimersByTimeAsync(100)
      await expect(resultPromise).resolves.toMatchObject({ status: 'unhealthy' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('probeRpcHealth', () => {
  it('is degraded when fallback preserves service after one provider fails', async () => {
    const registry = new Map([
      [
        sepolia.id,
        {
          chain: sepolia,
          providers: [
            { id: 'primary', name: 'Primary', url: 'https://primary.example' },
            { id: 'fallback', name: 'Fallback', url: 'https://fallback.example' },
          ],
        },
      ],
      [
        mainnet.id,
        {
          chain: mainnet,
          providers: [{ id: 'mainnet', name: 'Mainnet', url: 'https://mainnet.example' }],
        },
      ],
    ])
    const report = await probeRpcHealth({
      registry,
      checkedAt: new Date('2026-01-01T00:00:00Z'),
      probe: async (current) => ({
        id: current.id,
        name: current.name,
        status: current.id === 'primary' ? 'unhealthy' : 'healthy',
        latencyMs: 1,
      }),
    })

    expect(report.status).toBe('degraded')
    expect(report.checkedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('is unhealthy when the critical write chain has no healthy provider', async () => {
    const registry = new Map([
      [
        sepolia.id,
        {
          chain: sepolia,
          providers: [{ id: 'primary', name: 'Primary', url: 'https://primary.example' }],
        },
      ],
    ])
    const report = await probeRpcHealth({
      registry,
      criticalChainIds: [sepolia.id],
      probe: async (current) => ({
        id: current.id,
        name: current.name,
        status: 'unhealthy',
        latencyMs: 1,
      }),
    })

    expect(report.status).toBe('unhealthy')
    expect(report.chains.find((chain) => chain.chainId === sepolia.id)?.status).toBe('unhealthy')
  })
})
