import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchedTransferDemo } from './BatchedTransferDemo'

const mocks = vi.hoisted(() => ({
  writeContractAsync: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  atomicSupport: 'unsupported' as 'supported' | 'ready' | 'unsupported',
  sendCallsResult: undefined as { id: string } | undefined,
  isSendingBatch: false,
  sendCallsError: null as Error | null,
  callsStatus: undefined as {
    status: 'pending' | 'success' | 'failure' | undefined
    receipts: { status: 'success' | 'reverted' }[]
  } | undefined,
  callsStatusError: null as Error | null,
}))

vi.mock('wagmi', () => ({
  useCapabilities: () => ({ data: { atomic: { status: mocks.atomicSupport } }, isLoading: false }),
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001' }),
  usePublicClient: () => ({ waitForTransactionReceipt: mocks.waitForTransactionReceipt }),
  useSendCalls: () => ({
    mutate: vi.fn(),
    data: mocks.sendCallsResult,
    isPending: mocks.isSendingBatch,
    error: mocks.sendCallsError,
  }),
  useWaitForCallsStatus: () => ({ data: mocks.callsStatus, error: mocks.callsStatusError }),
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
    mocks.atomicSupport = 'unsupported'
    mocks.sendCallsResult = undefined
    mocks.isSendingBatch = false
    mocks.sendCallsError = null
    mocks.callsStatus = undefined
    mocks.callsStatusError = null
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

  it('locks the atomic action while the bundle is confirming', () => {
    mocks.atomicSupport = 'supported'
    mocks.sendCallsResult = { id: 'bundle-1' }
    mocks.callsStatus = { status: 'pending', receipts: [] }

    render(<BatchedTransferDemo />)

    expect(screen.getByRole('button', { name: '批量交易链上确认中…' })).toBeDisabled()
  })

  it('fails closed when a successful atomic response contains a reverted receipt', () => {
    mocks.atomicSupport = 'supported'
    mocks.sendCallsResult = { id: 'bundle-1' }
    mocks.callsStatus = {
      status: 'success',
      receipts: [{ status: 'success' }, { status: 'reverted' }],
    }

    render(<BatchedTransferDemo />)

    expect(screen.getByText(/没有任何一笔应被视为成功/)).toBeInTheDocument()
    expect(screen.queryByText('原子批量交易已确认')).not.toBeInTheDocument()
  })
})
