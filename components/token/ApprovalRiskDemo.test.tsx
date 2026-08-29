import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApprovalRiskDemo } from './ApprovalRiskDemo'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const CHAIN_ID = 11155111
const APPROVAL_HASH = `0x${'01'.repeat(32)}` as `0x${string}`
const REPLACEMENT_HASH = `0x${'02'.repeat(32)}` as `0x${string}`
const APPROVAL_STORAGE_KEY = `web3-lab:pending-tx:v1:${CHAIN_ID}:${ACCOUNT}:approval`

function seedPendingApproval(hash = APPROVAL_HASH) {
  localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify({
    version: 1,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    kind: 'approval',
    hash,
    createdAt: Date.now(),
  }))
}

const mocks = vi.hoisted(() => ({
  writeContract: vi.fn(),
  isAwaitingWallet: false,
  writeError: null as Error | null,
  isConfirming: false,
  isApproved: false,
  receiptError: null as Error | null,
  chainId: 11155111,
  receiptHash: undefined as `0x${string}` | undefined,
  replacementCallback: undefined as ((event: {
    reason: 'cancelled' | 'replaced' | 'repriced'
    transaction: { hash: `0x${string}` }
  }) => void) | undefined,
}))

vi.mock('wagmi', () => ({
  useWriteContract: () => ({
    mutate: mocks.writeContract,
    isPending: mocks.isAwaitingWallet,
    error: mocks.writeError,
  }),
  useWaitForTransactionReceipt: (options: { hash?: `0x${string}`; onReplaced?: typeof mocks.replacementCallback }) => {
    mocks.receiptHash = options.hash
    mocks.replacementCallback = options.onReplaced
    return {
      isLoading: mocks.isConfirming,
      isSuccess: mocks.isApproved,
      error: mocks.receiptError,
    }
  },
}))

vi.mock('@/lib/hooks/useWalletSession', () => ({
  useWalletSession: () => ({
    session: { address: ACCOUNT },
    walletAddress: ACCOUNT,
    chainId: mocks.chainId,
    status: 'matched',
    isAuthenticatedWallet: true,
  }),
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

describe('ApprovalRiskDemo lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.writeContract.mockReset()
    mocks.isAwaitingWallet = false
    mocks.writeError = null
    mocks.isConfirming = false
    mocks.isApproved = false
    mocks.receiptError = null
    mocks.chainId = 11155111
    mocks.replacementCallback = undefined
    mocks.receiptHash = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('locks both approval entries while AI risk detection is pending', async () => {
    let resolveFetch!: (response: Response) => void
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal('fetch', vi.fn(() => fetchPromise))
    render(<ApprovalRiskDemo />)

    fireEvent.click(screen.getByRole('button', { name: '无限额度授权（演示风险）' }))

    expect(await screen.findByText('AI 风险检测中…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '小额授权（推荐）' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '无限额度授权（演示风险）' })).toBeDisabled()

    resolveFetch({
      ok: true,
      json: async () => ({ warning: '无限授权风险' }),
    } as Response)
    await waitFor(() => expect(screen.getByText('无限授权风险')).toBeInTheDocument())
    expect(localStorage.length).toBe(0)
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('keeps deterministic risk evidence and explicit confirmation when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    render(<ApprovalRiskDemo />)

    fireEvent.click(screen.getByRole('button', { name: '无限额度授权（演示风险）' }))

    expect(await screen.findByText(/无限额度代币使用权/)).toBeInTheDocument()
    expect(screen.getByText(/AI 解释服务暂时无法连接/)).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: '我已了解风险，继续' })
    expect(mocks.writeContract).not.toHaveBeenCalled()

    fireEvent.click(confirmButton)

    expect(mocks.writeContract).toHaveBeenCalledTimes(1)
  })

  it('does not treat an explicit API rejection as an AI-only outage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => { throw new Error('malformed error body') },
    }))
    render(<ApprovalRiskDemo />)

    fireEvent.click(screen.getByRole('button', { name: '无限额度授权（演示风险）' }))

    expect(await screen.findByText('风险检测失败，请稍后重试')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '我已了解风险，继续' })).not.toBeInTheDocument()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('restores a pending approval and resumes its receipt query', async () => {
    seedPendingApproval()
    mocks.isConfirming = true

    render(<ApprovalRiskDemo />)

    expect(await screen.findByText('授权交易链上确认中…')).toBeInTheDocument()
    expect(mocks.receiptHash).toBe(APPROVAL_HASH)
  })

  it('stores an approval only after the wallet returns a transaction hash', async () => {
    mocks.writeContract.mockImplementation((_request, options) => options.onSuccess(APPROVAL_HASH))
    render(<ApprovalRiskDemo />)

    fireEvent.click(screen.getByRole('button', { name: '小额授权（推荐）' }))

    await waitFor(() => expect(localStorage.getItem(APPROVAL_STORAGE_KEY)).toContain(APPROVAL_HASH))
    expect(mocks.receiptHash).toBe(APPROVAL_HASH)
  })

  it('clears a restored approval after confirmation', async () => {
    seedPendingApproval()
    mocks.isApproved = true
    render(<ApprovalRiskDemo />)

    expect(await screen.findByText('授权成功！')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(APPROVAL_STORAGE_KEY)).toBeNull())
  })

  it('stores the replacement hash when an approval is repriced', async () => {
    seedPendingApproval()
    render(<ApprovalRiskDemo />)
    await waitFor(() => expect(mocks.receiptHash).toBe(APPROVAL_HASH))

    act(() => {
      mocks.replacementCallback?.({ reason: 'repriced', transaction: { hash: REPLACEMENT_HASH } })
    })

    expect(localStorage.getItem(APPROVAL_STORAGE_KEY)).toContain(REPLACEMENT_HASH)
    expect(screen.getByText(/加速了交易/)).toBeInTheDocument()
  })

  it('distinguishes wallet confirmation from chain confirmation', () => {
    mocks.isAwaitingWallet = true
    const { rerender } = render(<ApprovalRiskDemo />)
    expect(screen.getByText('等待钱包确认授权…')).toBeInTheDocument()

    mocks.isAwaitingWallet = false
    mocks.isConfirming = true
    rerender(<ApprovalRiskDemo />)
    expect(screen.getByText('授权交易链上确认中…')).toBeInTheDocument()
  })

  it('shows a specific message when the wallet rejects approval', () => {
    mocks.writeError = new Error('User rejected the request')
    render(<ApprovalRiskDemo />)

    expect(screen.getByText('你取消了这笔交易')).toBeInTheDocument()
  })

  it('removes approval success when the transaction is cancelled', () => {
    mocks.isApproved = true
    render(<ApprovalRiskDemo />)
    expect(screen.getByText('授权成功！')).toBeInTheDocument()

    act(() => {
      mocks.replacementCallback?.({ reason: 'cancelled', transaction: { hash: REPLACEMENT_HASH } })
    })

    expect(screen.queryByText('授权成功！')).not.toBeInTheDocument()
    expect(screen.getByText(/取消原交易/)).toBeInTheDocument()
  })

  it('ignores a replacement callback created under an old chain context', () => {
    const { rerender } = render(<ApprovalRiskDemo />)
    const oldContextCallback = mocks.replacementCallback

    mocks.chainId = 1
    rerender(<ApprovalRiskDemo />)
    act(() => {
      oldContextCallback?.({ reason: 'cancelled', transaction: { hash: REPLACEMENT_HASH } })
    })

    expect(screen.queryByText(/取消原交易/)).not.toBeInTheDocument()
  })
})
