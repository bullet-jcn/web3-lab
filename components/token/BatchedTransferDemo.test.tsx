import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchedTransferDemo } from './BatchedTransferDemo'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const CHAIN_ID = 11155111
const ATOMIC_ID = 'wallet-bundle:42'
const ATOMIC_STORAGE_KEY = `web3-lab:pending-batch:v1:${CHAIN_ID}:${ACCOUNT}:atomic`

const mocks = vi.hoisted(() => ({
  writeContractAsync: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  sendCalls: vi.fn(),
  waitForCallsId: undefined as string | undefined,
  atomicSupport: 'unsupported' as 'supported' | 'ready' | 'unsupported',
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
  useConnection: () => ({ address: ACCOUNT }),
  usePublicClient: () => ({ waitForTransactionReceipt: mocks.waitForTransactionReceipt }),
  useSendCalls: () => ({
    mutate: mocks.sendCalls,
    isPending: mocks.isSendingBatch,
    error: mocks.sendCallsError,
  }),
  useWaitForCallsStatus: ({ id }: { id?: string }) => {
    mocks.waitForCallsId = id
    return { data: mocks.callsStatus, error: mocks.callsStatusError }
  },
  useWriteContract: () => ({ mutateAsync: mocks.writeContractAsync }),
}))

vi.mock('@/lib/hooks/useWriteChainGuard', () => ({
  useWriteChainGuard: () => ({
    chainId: CHAIN_ID,
    writeChain: { id: CHAIN_ID, name: 'Ethereum Sepolia' },
    isCorrectChain: true,
    switchToWriteChain: vi.fn(),
    isSwitchingChain: false,
    switchChainError: null,
  }),
}))

function seedPendingAtomicBatch() {
  localStorage.setItem(ATOMIC_STORAGE_KEY, JSON.stringify({
    version: 1,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    mode: 'atomic',
    id: ATOMIC_ID,
    createdAt: Date.now(),
  }))
}

describe('BatchedTransferDemo', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.writeContractAsync.mockReset()
    mocks.waitForTransactionReceipt.mockReset()
    mocks.sendCalls.mockReset()
    mocks.waitForCallsId = undefined
    mocks.atomicSupport = 'unsupported'
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

  it('stores a wallet-returned atomic id and starts querying it', async () => {
    mocks.atomicSupport = 'supported'
    mocks.sendCalls.mockImplementation((_request, options) => options.onSuccess({ id: ATOMIC_ID }))
    render(<BatchedTransferDemo />)

    fireEvent.click(screen.getByRole('button', { name: '批量转账(原子)' }))

    await waitFor(() => expect(localStorage.getItem(ATOMIC_STORAGE_KEY)).toContain(ATOMIC_ID))
    expect(mocks.waitForCallsId).toBe(ATOMIC_ID)
    expect(mocks.sendCalls).toHaveBeenCalledTimes(1)
  })

  it('restores an atomic id and only resumes the status query', async () => {
    seedPendingAtomicBatch()
    mocks.atomicSupport = 'supported'
    mocks.callsStatus = { status: 'pending', receipts: [] }

    render(<BatchedTransferDemo />)

    expect(await screen.findByRole('button', { name: '批量交易链上确认中…' })).toBeDisabled()
    expect(mocks.waitForCallsId).toBe(ATOMIC_ID)
    expect(mocks.sendCalls).not.toHaveBeenCalled()
  })

  it('keeps tracking a restored atomic batch if capability detection changes', async () => {
    seedPendingAtomicBatch()
    mocks.atomicSupport = 'unsupported'
    mocks.callsStatus = { status: 'pending', receipts: [] }

    render(<BatchedTransferDemo />)

    expect(await screen.findByRole('button', { name: '批量交易链上确认中…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '顺序转账(非原子)' })).not.toBeInTheDocument()
  })

  it('clears storage when an atomic batch reaches success', async () => {
    seedPendingAtomicBatch()
    mocks.atomicSupport = 'supported'
    mocks.callsStatus = { status: 'success', receipts: [{ status: 'success' }] }
    render(<BatchedTransferDemo />)

    expect(await screen.findByText('原子批量交易已确认')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(ATOMIC_STORAGE_KEY)).toBeNull())
  })

  it('fails closed and clears storage when a successful response contains a reverted receipt', async () => {
    seedPendingAtomicBatch()
    mocks.atomicSupport = 'supported'
    mocks.callsStatus = {
      status: 'success',
      receipts: [{ status: 'success' }, { status: 'reverted' }],
    }
    render(<BatchedTransferDemo />)

    expect(await screen.findByText(/没有任何一笔应被视为成功/)).toBeInTheDocument()
    expect(screen.queryByText('原子批量交易已确认')).not.toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(ATOMIC_STORAGE_KEY)).toBeNull())
  })

  it('retains storage after a status query error so refresh can retry', async () => {
    seedPendingAtomicBatch()
    mocks.atomicSupport = 'supported'
    mocks.callsStatusError = new Error('RPC unavailable')
    render(<BatchedTransferDemo />)

    expect(await screen.findByText('转账失败，请重试')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '批量状态暂时无法确认' })).toBeDisabled()
    expect(localStorage.getItem(ATOMIC_STORAGE_KEY)).toContain(ATOMIC_ID)
    expect(mocks.sendCalls).not.toHaveBeenCalled()
  })
})
