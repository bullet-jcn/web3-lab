import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApprovalRiskDemo } from './ApprovalRiskDemo'

const mocks = vi.hoisted(() => ({
  writeContract: vi.fn(),
  isAwaitingWallet: false,
  writeError: null as Error | null,
  isConfirming: false,
  isApproved: false,
  receiptError: null as Error | null,
  chainId: 11155111,
  replacementCallback: undefined as ((event: {
    reason: 'cancelled' | 'replaced' | 'repriced'
    transaction: { hash: `0x${string}` }
  }) => void) | undefined,
}))

vi.mock('wagmi', () => ({
  useWriteContract: () => ({
    mutate: mocks.writeContract,
    data: '0x01',
    isPending: mocks.isAwaitingWallet,
    error: mocks.writeError,
  }),
  useWaitForTransactionReceipt: (options: { onReplaced?: typeof mocks.replacementCallback }) => {
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
    session: { address: '0x0000000000000000000000000000000000000001' },
    walletAddress: '0x0000000000000000000000000000000000000001',
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
    mocks.writeContract.mockReset()
    mocks.isAwaitingWallet = false
    mocks.writeError = null
    mocks.isConfirming = false
    mocks.isApproved = false
    mocks.receiptError = null
    mocks.chainId = 11155111
    mocks.replacementCallback = undefined
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
      mocks.replacementCallback?.({ reason: 'cancelled', transaction: { hash: '0x02' } })
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
      oldContextCallback?.({ reason: 'cancelled', transaction: { hash: '0x02' } })
    })

    expect(screen.queryByText(/取消原交易/)).not.toBeInTheDocument()
  })
})
