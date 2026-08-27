import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchedTransferDemo } from './BatchedTransferDemo'

const mocks = vi.hoisted(() => ({
  writeContractAsync: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}))

vi.mock('wagmi', () => ({
  useCapabilities: () => ({ data: { atomic: { status: 'unsupported' } }, isLoading: false }),
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001' }),
  usePublicClient: () => ({ waitForTransactionReceipt: mocks.waitForTransactionReceipt }),
  useSendCalls: () => ({ mutate: vi.fn(), data: undefined, isPending: false, error: null }),
  useWaitForCallsStatus: () => ({ data: undefined }),
  useWriteContract: () => ({ mutateAsync: mocks.writeContractAsync }),
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

describe('BatchedTransferDemo sequential fallback', () => {
  beforeEach(() => {
    mocks.writeContractAsync.mockReset()
    mocks.waitForTransactionReceipt.mockReset()
  })

  it('does not request the second transfer when the first receipt reverts', async () => {
    mocks.writeContractAsync.mockResolvedValueOnce('0x01')
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'reverted' })
    render(<BatchedTransferDemo />)

    fireEvent.click(screen.getByRole('button', { name: '顺序转账(非原子)' }))

    await waitFor(() => expect(screen.getByText(/first transfer/)).toBeInTheDocument())
    expect(mocks.writeContractAsync).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/第一笔已经链上确认/)).not.toBeInTheDocument()
  })

  it('reports partial success when the second wallet request fails', async () => {
    mocks.writeContractAsync
      .mockResolvedValueOnce('0x01')
      .mockRejectedValueOnce(new Error('User rejected the request'))
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'success' })
    render(<BatchedTransferDemo />)

    fireEvent.click(screen.getByRole('button', { name: '顺序转账(非原子)' }))

    await waitFor(() => expect(screen.getByText(/第一笔已经链上确认/)).toBeInTheDocument())
    expect(mocks.writeContractAsync).toHaveBeenCalledTimes(2)
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/User rejected/)).toBeInTheDocument()
  })
})
