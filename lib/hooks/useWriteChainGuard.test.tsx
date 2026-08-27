import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import { useWriteChainGuard } from './useWriteChainGuard'

const wagmiMocks = vi.hoisted(() => ({
  chainId: 11155111 as number | undefined,
  mutate: vi.fn(),
}))

vi.mock('wagmi', () => ({
  useConnection: () => ({ chainId: wagmiMocks.chainId }),
  useSwitchChain: () => ({
    mutate: wagmiMocks.mutate,
    isPending: false,
    error: null,
  }),
}))

describe('useWriteChainGuard', () => {
  beforeEach(() => {
    wagmiMocks.chainId = sepolia.id
    wagmiMocks.mutate.mockReset()
  })

  it('accepts the configured write chain', () => {
    const { result } = renderHook(() => useWriteChainGuard())

    expect(result.current.isCorrectChain).toBe(true)
    expect(result.current.writeChain.id).toBe(sepolia.id)
  })

  it('rejects a different chain', () => {
    wagmiMocks.chainId = mainnet.id

    const { result } = renderHook(() => useWriteChainGuard())

    expect(result.current.isCorrectChain).toBe(false)
  })

  it('switches to the configured write chain', () => {
    const { result } = renderHook(() => useWriteChainGuard())

    act(() => result.current.switchToWriteChain())

    expect(wagmiMocks.mutate).toHaveBeenCalledWith({ chainId: sepolia.id })
  })
})
