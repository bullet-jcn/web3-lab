import { describe, expect, it, vi } from 'vitest'
import { sepolia } from 'viem/chains'
import {
  buildRpcProviderRegistry,
  createRpcTransport,
  getRpcConnectSources,
  RPC_PROVIDER_RETRY_COUNT,
  type RpcProviderDefinition,
} from './rpc'

describe('RPC provider registry', () => {
  it('omits an absent or placeholder Alchemy URL instead of emitting undefined credentials', () => {
    for (const environment of [
      {},
      { NEXT_PUBLIC_ALCHEMY_API_KEY: 'your-alchemy-api-key' },
    ]) {
      const providers = buildRpcProviderRegistry(environment).get(sepolia.id)!.providers
      expect(providers.some((provider) => provider.id === 'alchemy')).toBe(false)
      expect(providers.every((provider) => !provider.url.includes('undefined'))).toBe(true)
    }
  })

  it('orders configured primary, independent fallback, and public emergency providers', () => {
    const providers = buildRpcProviderRegistry({
      NEXT_PUBLIC_ALCHEMY_API_KEY: 'alchemy-key',
      NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL: 'https://fallback.example/rpc/',
    }).get(sepolia.id)!.providers

    expect(providers.map((provider) => provider.id)).toEqual([
      'alchemy',
      'configured-fallback',
      'public-1',
    ])
    expect(providers[1].url).toBe('https://fallback.example/rpc')
  })

  it('rejects fallback URLs containing embedded credentials', () => {
    expect(() =>
      buildRpcProviderRegistry({
        NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL:
          'https://username:password@fallback.example',
      }),
    ).toThrow('credential-free HTTP(S) URL')
  })

  it('derives CSP origins without exposing provider paths or API keys', () => {
    const registry = buildRpcProviderRegistry({
      NEXT_PUBLIC_ALCHEMY_API_KEY: 'secret-key',
      NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL: 'https://fallback.example/private/path',
    })
    const sources = getRpcConnectSources(registry)

    expect(sources).toContain('https://eth-sepolia.g.alchemy.com')
    expect(sources).toContain('https://fallback.example')
    expect(JSON.stringify(sources)).not.toContain('secret-key')
    expect(JSON.stringify(sources)).not.toContain('/private/path')
  })
})

describe('bounded RPC fallback transport', () => {
  const providers: RpcProviderDefinition[] = [
    { id: 'primary', name: 'Primary', url: 'https://primary.example' },
    { id: 'fallback', name: 'Fallback', url: 'https://fallback.example' },
  ]

  it('tries the next provider once after the primary fails', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ jsonrpc: '2.0', id: 1, result: '0x2a' }),
      )
    const transport = createRpcTransport(providers, { fetchFn, timeoutMs: 500 })({
      chain: sepolia,
    })

    await expect(transport.request({ method: 'eth_blockNumber' })).resolves.toBe('0x2a')
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(RPC_PROVIDER_RETRY_COUNT).toBe(0)
  })

  it('does not loop back through providers after the finite budget is exhausted', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('unavailable', { status: 503 }),
    )
    const transport = createRpcTransport(providers, { fetchFn, timeoutMs: 500 })({
      chain: sepolia,
    })

    await expect(transport.request({ method: 'eth_blockNumber' })).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('does not fail over after a deterministic execution revert', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        jsonrpc: '2.0',
        id: 1,
        error: { code: 3, message: 'execution reverted: denied' },
      }),
    )
    const transport = createRpcTransport(providers, { fetchFn, timeoutMs: 500 })({
      chain: sepolia,
    })

    await expect(transport.request({ method: 'eth_call', params: [] })).rejects.toThrow(
      'execution reverted',
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('rejects empty provider sets and unbounded timeout values', () => {
    expect(() => createRpcTransport([])).toThrow('At least one RPC provider')
    expect(() => createRpcTransport(providers, { timeoutMs: 30_001 })).toThrow(
      'between 100 and 30000',
    )
  })
})
