import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useMultiChainBalance } from './useMultiChainBalance'
import type { ChainBalanceConfig } from '@/lib/chains'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function fakeChain(overrides: Partial<ChainBalanceConfig> = {}): ChainBalanceConfig {
  return {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    client: { getBalance: vi.fn().mockResolvedValue(BigInt(1000000000000000000)) } as never,
    ...overrides,
  } as ChainBalanceConfig
}

describe('useMultiChainBalance', () => {
  it('returns a formatted balance per configured chain', async () => {
    const chains = [fakeChain()]
    const { result } = renderHook(
      () => useMultiChainBalance('0x0000000000000000000000000000000000000001', chains),
      { wrapper },
    )

    await waitFor(() => expect(result.current[0].isLoading).toBe(false))

    expect(result.current[0]).toMatchObject({
      id: 'sepolia',
      balance: '1',
      error: null,
    })
  })

  it('reports a per-chain error without failing the others', async () => {
    const chains = [
      fakeChain({
        id: 'sepolia',
        client: { getBalance: vi.fn().mockRejectedValue(new Error('boom')) } as never,
      }),
      fakeChain({
        id: 'baseSepolia',
        name: 'Base Sepolia',
        chainId: 84532,
        client: { getBalance: vi.fn().mockResolvedValue(BigInt(2000000000000000000)) } as never,
      }),
    ]

    const { result } = renderHook(
      () => useMultiChainBalance('0x0000000000000000000000000000000000000001', chains),
      { wrapper },
    )

    await waitFor(() => expect(result.current.every((c) => !c.isLoading)).toBe(true))

    expect(result.current[0].error).not.toBeNull()
    expect(result.current[1]).toMatchObject({ id: 'baseSepolia', balance: '2', error: null })
  })

  it('does not query anything when there is no connected address', () => {
    const { result } = renderHook(() => useMultiChainBalance(undefined, [fakeChain()]), { wrapper })

    expect(result.current[0].isLoading).toBe(false)
    expect(result.current[0].balance).toBeNull()
  })
})
