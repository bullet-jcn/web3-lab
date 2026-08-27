import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenTransferPanel } from './TokenTransferPanel'

type ReplacementCallback = (event: {
  reason: 'cancelled' | 'replaced' | 'repriced'
  transaction: { hash: `0x${string}` }
}) => void

const mocks = vi.hoisted(() => ({
  receiptCallbacks: new Map<string, ReplacementCallback>(),
}))

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001' }),
  useReadContract: () => ({ data: BigInt(1) }),
  useSimulateContract: () => ({ error: null }),
  useWriteContract: () => ({ mutate: vi.fn(), data: '0x01', isPending: false, error: null }),
  useSendTransaction: () => ({ mutate: vi.fn(), data: '0x02', isPending: false, error: null }),
  useWaitForTransactionReceipt: (options: { hash?: string; onReplaced?: ReplacementCallback }) => {
    if (options.hash && options.onReplaced) mocks.receiptCallbacks.set(options.hash, options.onReplaced)
    return {
      isLoading: false,
      isSuccess: options.hash === '0x01',
      error: null,
    }
  },
}))

vi.mock('@/lib/hooks/useWriteChainGuard', () => ({
  useWriteChainGuard: () => ({
    writeChain: { id: 11155111, name: 'Ethereum Sepolia' },
    isCorrectChain: true,
    switchToWriteChain: vi.fn(),
    isSwitchingChain: false,
    switchChainError: null,
  }),
}))

describe('TokenTransferPanel transaction replacements', () => {
  beforeEach(() => {
    mocks.receiptCallbacks.clear()
  })

  it('removes the success state when the original transfer is cancelled', () => {
    render(<TokenTransferPanel />)
    expect(screen.getByText('转账成功!')).toBeInTheDocument()

    act(() => {
      mocks.receiptCallbacks.get('0x01')?.({ reason: 'cancelled', transaction: { hash: '0x03' } })
    })

    expect(screen.queryByText('转账成功!')).not.toBeInTheDocument()
    expect(screen.getByText(/取消原交易/)).toBeInTheDocument()
  })

  it('keeps success when the transaction is only repriced', () => {
    render(<TokenTransferPanel />)

    act(() => {
      mocks.receiptCallbacks.get('0x01')?.({ reason: 'repriced', transaction: { hash: '0x03' } })
    })

    expect(screen.getByText('转账成功!')).toBeInTheDocument()
    expect(screen.getByText(/加速了交易/)).toBeInTheDocument()
  })
})
