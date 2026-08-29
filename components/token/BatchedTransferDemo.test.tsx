import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchedTransferDemo } from './BatchedTransferDemo'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const CHAIN_ID = 11155111
const ATOMIC_ID = 'wallet-bundle:42'
const ATOMIC_STORAGE_KEY = `web3-lab:pending-batch:v1:${CHAIN_ID}:${ACCOUNT}:atomic`
const FIRST_HASH = `0x${'01'.repeat(32)}` as `0x${string}`
const SECOND_HASH = `0x${'02'.repeat(32)}` as `0x${string}`
const SEQUENTIAL_STORAGE_KEY = `web3-lab:pending-batch:v1:${CHAIN_ID}:${ACCOUNT}:sequential`

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

function seedPendingSequentialBatch(
  stage: 'first-pending' | 'first-confirmed' | 'second-pending',
) {
  localStorage.setItem(SEQUENTIAL_STORAGE_KEY, JSON.stringify({
    version: 1,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    mode: 'sequential',
    stage,
    firstHash: FIRST_HASH,
    ...(stage === 'second-pending' ? { secondHash: SECOND_HASH } : {}),
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
    mocks.writeContractAsync.mockResolvedValueOnce(FIRST_HASH)
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'reverted' })
    render(<BatchedTransferDemo />)

    fireEvent.click(screen.getByRole('button', { name: '顺序转账(非原子)' }))

    await waitFor(() => expect(screen.getByText(/first transfer/)).toBeInTheDocument())
    expect(mocks.writeContractAsync).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/第一笔已经链上确认/)).not.toBeInTheDocument()
    expect(localStorage.getItem(SEQUENTIAL_STORAGE_KEY)).toBeNull()
  })

  it('reports partial success when the second wallet request fails', async () => {
    mocks.writeContractAsync
      .mockResolvedValueOnce(FIRST_HASH)
      .mockRejectedValueOnce(new Error('User rejected the request'))
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'success' })
    render(<BatchedTransferDemo />)

    fireEvent.click(screen.getByRole('button', { name: '顺序转账(非原子)' }))

    await waitFor(() => expect(screen.getByText(/第一笔已经链上确认/)).toBeInTheDocument())
    expect(mocks.writeContractAsync).toHaveBeenCalledTimes(2)
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/User rejected/)).toBeInTheDocument()
    expect(localStorage.getItem(SEQUENTIAL_STORAGE_KEY)).toContain('first-confirmed')
    expect(screen.getByRole('button', { name: '批次已中断，请先核对记录' })).toBeDisabled()
  })

  it('clears a reverted second receipt but keeps the whole-batch action locked', async () => {
    mocks.writeContractAsync
      .mockResolvedValueOnce(FIRST_HASH)
      .mockResolvedValueOnce(SECOND_HASH)
    mocks.waitForTransactionReceipt
      .mockResolvedValueOnce({ status: 'success' })
      .mockResolvedValueOnce({ status: 'reverted' })
    render(<BatchedTransferDemo />)

    fireEvent.click(screen.getByRole('button', { name: '顺序转账(非原子)' }))

    expect(await screen.findByText(/第二笔失败或被取消/)).toBeInTheDocument()
    expect(localStorage.getItem(SEQUENTIAL_STORAGE_KEY)).toBeNull()
    expect(screen.getByRole('button', { name: '批次部分完成，请先核对记录' })).toBeDisabled()
  })

  it('restores the first receipt, then stops before the second wallet request', async () => {
    seedPendingSequentialBatch('first-pending')
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'success' })
    render(<BatchedTransferDemo />)

    expect(await screen.findByText(/第二笔尚未提交/)).toBeInTheDocument()
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: FIRST_HASH })
    expect(mocks.writeContractAsync).not.toHaveBeenCalled()
    expect(localStorage.getItem(SEQUENTIAL_STORAGE_KEY)).toContain('first-confirmed')
    expect(screen.getByRole('button', { name: '批次已中断，请先核对记录' })).toBeDisabled()
  })

  it('restores the between-wallet-requests stage without querying or sending', async () => {
    seedPendingSequentialBatch('first-confirmed')
    render(<BatchedTransferDemo />)

    expect(await screen.findByText(/第二笔尚未提交/)).toBeInTheDocument()
    expect(mocks.waitForTransactionReceipt).not.toHaveBeenCalled()
    expect(mocks.writeContractAsync).not.toHaveBeenCalled()
  })

  it('restores the second receipt and clears storage after success', async () => {
    seedPendingSequentialBatch('second-pending')
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'success' })
    render(<BatchedTransferDemo />)

    expect(await screen.findByText('两笔转账都已完成')).toBeInTheDocument()
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: SECOND_HASH })
    expect(mocks.writeContractAsync).not.toHaveBeenCalled()
    expect(localStorage.getItem(SEQUENTIAL_STORAGE_KEY)).toBeNull()
  })

  it('retains a sequential record and locks resubmission after a query error', async () => {
    seedPendingSequentialBatch('first-pending')
    mocks.waitForTransactionReceipt.mockRejectedValueOnce(new Error('RPC unavailable'))
    render(<BatchedTransferDemo />)

    expect(await screen.findByText('RPC unavailable')).toBeInTheDocument()
    expect(localStorage.getItem(SEQUENTIAL_STORAGE_KEY)).toContain('first-pending')
    expect(screen.getByRole('button', { name: '批次状态暂时无法确认' })).toBeDisabled()
    expect(mocks.writeContractAsync).not.toHaveBeenCalled()
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
