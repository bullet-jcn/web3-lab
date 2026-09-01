import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maxUint256 } from 'viem'
import { ApprovalInventory } from './ApprovalInventory'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const TOKEN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
const SPENDER = '0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b'
const REVOKE_HASH = `0x${'03'.repeat(32)}` as `0x${string}`
const REPLACEMENT_HASH = `0x${'04'.repeat(32)}` as `0x${string}`
const REVOKE_STORAGE_KEY = `web3-lab:pending-approval-revoke:v1:11155111:${ACCOUNT}`
const SIMULATION_REQUEST = {
  address: TOKEN,
  functionName: 'approve',
  args: [SPENDER, BigInt(0)],
  chainId: 11155111,
}

function seedPendingRevoke(hash = REVOKE_HASH, targetId = 'sepolia-usdc-demo-spender') {
  localStorage.setItem(REVOKE_STORAGE_KEY, JSON.stringify({
    version: 1,
    account: ACCOUNT,
    chainId: 11155111,
    targetId,
    hash,
    createdAt: Date.now(),
  }))
}

const mocks = vi.hoisted(() => ({
  address: '0x0000000000000000000000000000000000000001' as `0x${string}` | undefined,
  data: [{ status: 'success', result: BigInt(1_500_000) }] as readonly unknown[] | undefined,
  error: null as Error | null,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
  readParameters: undefined as unknown,
  chainId: 11155111,
  isCorrectChain: true,
  switchToWriteChain: vi.fn(),
  simulationData: {
    request: {
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      functionName: 'approve',
      args: ['0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b', BigInt(0)],
      chainId: 11155111,
    },
  } as { request: typeof SIMULATION_REQUEST } | undefined,
  simulationError: null as Error | null,
  isSimulating: false,
  simulateParameters: undefined as unknown,
  writeContract: vi.fn(),
  resetWrite: vi.fn(),
  isAwaitingWallet: false,
  writeError: null as Error | null,
  receiptData: undefined as { status: 'success' | 'reverted' } | undefined,
  isConfirming: false,
  isReceiptSuccess: false,
  receiptError: null as Error | null,
  receiptRefetch: vi.fn(),
  isReceiptRefetching: false,
  receiptHash: undefined as `0x${string}` | undefined,
  receiptParameters: undefined as unknown,
  replacementCallback: undefined as ((event: {
    reason: 'cancelled' | 'replaced' | 'repriced'
    transaction: { hash: `0x${string}` }
  }) => void) | undefined,
}))

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address, chainId: mocks.chainId }),
  useReadContracts: (parameters: unknown) => {
    mocks.readParameters = parameters
    return {
      data: mocks.data,
      error: mocks.error,
      isPending: mocks.isPending,
      isFetching: mocks.isFetching,
      refetch: mocks.refetch,
    }
  },
  useSimulateContract: (parameters: unknown) => {
    mocks.simulateParameters = parameters
    return {
      data: mocks.simulationData,
      error: mocks.simulationError,
      isPending: mocks.isSimulating,
    }
  },
  useWriteContract: () => ({
    mutate: mocks.writeContract,
    isPending: mocks.isAwaitingWallet,
    error: mocks.writeError,
    reset: mocks.resetWrite,
  }),
  useWaitForTransactionReceipt: (parameters: {
    hash?: `0x${string}`
    onReplaced?: typeof mocks.replacementCallback
  }) => {
    mocks.receiptHash = parameters.hash
    mocks.receiptParameters = parameters
    mocks.replacementCallback = parameters.onReplaced
    return {
      data: mocks.receiptData,
      isLoading: mocks.isConfirming,
      isSuccess: mocks.isReceiptSuccess,
      error: mocks.receiptError,
      refetch: mocks.receiptRefetch,
      isRefetching: mocks.isReceiptRefetching,
    }
  },
}))

vi.mock('@/lib/hooks/useWriteChainGuard', () => ({
  useWriteChainGuard: () => ({
    chainId: mocks.chainId,
    writeChain: { id: 11155111, name: 'Ethereum Sepolia' },
    isCorrectChain: mocks.isCorrectChain,
    switchToWriteChain: mocks.switchToWriteChain,
    isSwitchingChain: false,
    switchChainError: null,
  }),
}))

describe('ApprovalInventory', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.address = ACCOUNT
    mocks.data = [{ status: 'success', result: BigInt(1_500_000) }]
    mocks.error = null
    mocks.isPending = false
    mocks.isFetching = false
    mocks.refetch.mockReset()
    mocks.readParameters = undefined
    mocks.chainId = 11155111
    mocks.isCorrectChain = true
    mocks.switchToWriteChain.mockReset()
    mocks.simulationData = { request: SIMULATION_REQUEST }
    mocks.simulationError = null
    mocks.isSimulating = false
    mocks.simulateParameters = undefined
    mocks.writeContract.mockReset()
    mocks.resetWrite.mockReset()
    mocks.isAwaitingWallet = false
    mocks.writeError = null
    mocks.receiptData = undefined
    mocks.isConfirming = false
    mocks.isReceiptSuccess = false
    mocks.receiptError = null
    mocks.receiptRefetch.mockReset()
    mocks.isReceiptRefetching = false
    mocks.receiptHash = undefined
    mocks.receiptParameters = undefined
    mocks.replacementCallback = undefined
  })

  it('states its limited coverage and reads the connected account on the target chain', () => {
    render(<ApprovalInventory />)

    expect(screen.getByText('有限覆盖：应用 Approval Registry')).toBeInTheDocument()
    expect(screen.getByText(/不是对该钱包全部历史授权的完整扫描/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(ACCOUNT))).toBeInTheDocument()
    expect(screen.getByText(TOKEN)).toBeInTheDocument()
    expect(screen.getByText(SPENDER)).toBeInTheDocument()
    expect(screen.getByText('当前额度：1.5 USDC')).toBeInTheDocument()
    expect(mocks.readParameters).toEqual(expect.objectContaining({
      allowFailure: true,
      query: { enabled: true },
    }))
    expect(mocks.readParameters).toEqual(expect.objectContaining({
      contracts: [expect.objectContaining({
        address: TOKEN,
        functionName: 'allowance',
        args: [ACCOUNT, SPENDER],
        chainId: 11155111,
      })],
    }))
  })

  it('distinguishes no approval from an unknown read result', () => {
    mocks.data = [{ status: 'success', result: BigInt(0) }]
    const { rerender } = render(<ApprovalInventory />)
    expect(screen.getByText('当前额度：0 USDC（未授权）')).toBeInTheDocument()

    mocks.data = [{ status: 'failure', error: new Error('RPC failed') }]
    rerender(<ApprovalInventory />)
    expect(screen.getByText('授权读取失败；结果未知，不能当作零授权。')).toBeInTheDocument()
  })

  it('highlights an exact uint256 maximum allowance', () => {
    mocks.data = [{ status: 'success', result: maxUint256 }]
    render(<ApprovalInventory />)

    expect(screen.getByText('当前额度：无限授权（uint256 最大值）')).toBeInTheDocument()
    expect(screen.getByText(`原始额度：${maxUint256.toString()}`)).toBeInTheDocument()
  })

  it('does not hide a top-level query failure as an empty inventory', () => {
    mocks.error = new Error('transport error')
    mocks.data = undefined
    render(<ApprovalInventory />)

    expect(screen.getByText('授权读取失败；结果未知，不能当作零授权。')).toBeInTheDocument()
  })

  it('supports an explicit refresh without issuing any write request', () => {
    render(<ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '刷新授权清单' }))
    expect(mocks.refetch).toHaveBeenCalledTimes(1)
  })

  it('does not run the inventory query before a wallet account exists', () => {
    mocks.address = undefined
    mocks.data = undefined
    mocks.isPending = true
    render(<ApprovalInventory />)

    expect(screen.getByText('连接钱包后查看已登记范围内的授权')).toBeInTheDocument()
    expect(mocks.readParameters).toEqual(expect.objectContaining({
      query: { enabled: false },
    }))
  })

  it('freezes a revoke review and does not write on the first click', () => {
    render(<ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '准备撤销授权' }))

    expect(screen.getByText('撤销授权 Review')).toBeInTheDocument()
    expect(screen.getByText('1.5 USDC')).toBeInTheDocument()
    expect(screen.getByText('0 USDC')).toBeInTheDocument()
    expect(screen.getByText(/模拟通过/)).toBeInTheDocument()
    expect(mocks.writeContract).not.toHaveBeenCalled()
    expect(mocks.simulateParameters).toEqual(expect.objectContaining({
      address: TOKEN,
      functionName: 'approve',
      args: [SPENDER, BigInt(0)],
      account: ACCOUNT,
      chainId: 11155111,
      query: { enabled: true, retry: false },
    }))
  })

  it('submits the exact simulated request and persists only after receiving a hash', async () => {
    mocks.writeContract.mockImplementation((_request, options) => options.onSuccess(REVOKE_HASH))
    render(<ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '准备撤销授权' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并请求钱包' }))

    expect(mocks.writeContract).toHaveBeenCalledWith(SIMULATION_REQUEST, expect.any(Object))
    await waitFor(() => expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toContain(REVOKE_HASH))
    expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toContain('sepolia-usdc-demo-spender')
    expect(mocks.receiptHash).toBe(REVOKE_HASH)
  })

  it('requires the wallet write chain but keeps the read-only inventory visible', () => {
    mocks.chainId = 1
    mocks.isCorrectChain = false
    render(<ApprovalInventory />)

    expect(screen.getByText('当前额度：1.5 USDC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '准备撤销授权' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '切换到 Sepolia' }))
    expect(mocks.switchToWriteChain).toHaveBeenCalledTimes(1)
  })

  it('blocks the wallet request when revoke simulation fails', () => {
    mocks.simulationData = undefined
    mocks.simulationError = new Error('execution reverted')
    render(<ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '准备撤销授权' }))

    expect(screen.getByText(/撤销模拟失败/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认并请求钱包' })).toBeDisabled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('restores a pending revoke and resumes its target-chain receipt query', async () => {
    seedPendingRevoke()
    mocks.isConfirming = true
    render(<ApprovalInventory />)

    expect(await screen.findByText('撤销交易链上确认中…')).toBeInTheDocument()
    expect(mocks.receiptHash).toBe(REVOKE_HASH)
    expect(mocks.receiptParameters).toEqual(expect.objectContaining({ chainId: 11155111 }))
    expect(screen.getByRole('button', { name: '准备撤销授权' })).toBeDisabled()
    expect(screen.getByRole('link', { name: '在区块浏览器查看撤销交易' })).toHaveAttribute(
      'href',
      `https://sepolia.etherscan.io/tx/${REVOKE_HASH}`,
    )
  })

  it('discards a syntactically valid pending target that no longer exists in the registry', async () => {
    seedPendingRevoke(REVOKE_HASH, 'removed-registry-target')
    render(<ApprovalInventory />)

    await waitFor(() => expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toBeNull())
    expect(mocks.receiptHash).toBeUndefined()
    expect(screen.getByRole('button', { name: '准备撤销授权' })).toBeEnabled()
  })

  it('keeps an unresolved hash locked and retries only its receipt observation', async () => {
    seedPendingRevoke()
    mocks.receiptError = new Error('transport error')
    render(<ApprovalInventory />)

    expect(await screen.findByText(/Hash 已保留，不能再次提交/)).toBeInTheDocument()
    expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toContain(REVOKE_HASH)
    fireEvent.click(screen.getByRole('button', { name: '重新查询这笔撤销' }))
    expect(mocks.receiptRefetch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '准备撤销授权' })).toBeDisabled()
  })

  it('clears the pending record and refreshes allowance only after a successful receipt', async () => {
    seedPendingRevoke()
    mocks.data = [{ status: 'success', result: BigInt(0) }]
    mocks.isReceiptSuccess = true
    mocks.receiptData = { status: 'success' }
    render(<ApprovalInventory />)

    expect(await screen.findByText(/链上 allowance 已归零/)).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toBeNull())
    expect(mocks.refetch).toHaveBeenCalledTimes(1)
  })

  it('does not claim the permission is gone when a confirmed transaction still reads nonzero', async () => {
    seedPendingRevoke()
    mocks.isReceiptSuccess = true
    mocks.receiptData = { status: 'success' }
    render(<ApprovalInventory />)

    expect(await screen.findByText(/最新 allowance 仍非零/)).toBeInTheDocument()
    expect(screen.queryByText(/allowance 已归零/)).not.toBeInTheDocument()
  })

  it('treats a reverted receipt as failure and does not refresh it as a successful revoke', async () => {
    seedPendingRevoke()
    mocks.isReceiptSuccess = true
    mocks.receiptData = { status: 'reverted' }
    render(<ApprovalInventory />)

    expect(await screen.findByText(/已上链但执行失败/)).toBeInTheDocument()
    expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toBeNull()
    expect(mocks.refetch).not.toHaveBeenCalled()
  })

  it('tracks a repriced revoke by its replacement hash', async () => {
    seedPendingRevoke()
    render(<ApprovalInventory />)
    await waitFor(() => expect(mocks.receiptHash).toBe(REVOKE_HASH))

    act(() => {
      mocks.replacementCallback?.({ reason: 'repriced', transaction: { hash: REPLACEMENT_HASH } })
    })

    expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toContain(REPLACEMENT_HASH)
    expect(screen.getByText(/加速了交易/)).toBeInTheDocument()
  })

  it('clears the original revoke when it is cancelled by a replacement transaction', async () => {
    seedPendingRevoke()
    render(<ApprovalInventory />)
    await waitFor(() => expect(mocks.receiptHash).toBe(REVOKE_HASH))

    act(() => {
      mocks.replacementCallback?.({ reason: 'cancelled', transaction: { hash: REPLACEMENT_HASH } })
    })

    expect(localStorage.getItem(REVOKE_STORAGE_KEY)).toBeNull()
    expect(screen.getByText(/取消原交易/)).toBeInTheDocument()
  })
})
