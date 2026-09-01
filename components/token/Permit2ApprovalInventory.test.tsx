import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maxUint160, maxUint256 } from 'viem'
import { Permit2ApprovalInventory } from './Permit2ApprovalInventory'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const TOKEN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
const SPENDER = '0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const EXPECTED_CODE_HASH = '0x96d9f5c3f0fb0423426b7f970186235b7347027f4e5c19c40c412b7d97fc3751'
const LOCKDOWN_HASH = `0x${'05'.repeat(32)}` as `0x${string}`
const REPLACEMENT_HASH = `0x${'06'.repeat(32)}` as `0x${string}`
const LOCKDOWN_STORAGE_KEY = `web3-lab:pending-permit2-lockdown:v1:11155111:${ACCOUNT}`
const SIMULATION_REQUEST = {
  address: PERMIT2,
  functionName: 'lockdown',
  args: [[{ token: TOKEN, spender: SPENDER }]],
  chainId: 11155111,
}

function seedPendingLockdown(hash = LOCKDOWN_HASH, targetId = 'sepolia-usdc-demo-spender-permit2') {
  localStorage.setItem(LOCKDOWN_STORAGE_KEY, JSON.stringify({
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
  reads: [
    { status: 'success', result: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') },
    { status: 'success', result: [BigInt(2_000_000), BigInt(3_000), BigInt(7)] },
  ] as readonly unknown[] | undefined,
  readsError: null as Error | null,
  readsPending: false,
  readsFetching: false,
  refetchReads: vi.fn(),
  readParameters: undefined as unknown,
  block: { timestamp: BigInt(2_000) } as { timestamp: bigint } | undefined,
  blockError: null as Error | null,
  blockPending: false,
  blockFetching: false,
  refetchBlock: vi.fn(),
  blockParameters: undefined as unknown,
  bytecode: '0x1234' as `0x${string}` | undefined,
  bytecodeError: null as Error | null,
  bytecodePending: false,
  bytecodeFetching: false,
  refetchBytecode: vi.fn(),
  bytecodeParameters: undefined as unknown,
  runtimeCodeHash: '0x96d9f5c3f0fb0423426b7f970186235b7347027f4e5c19c40c412b7d97fc3751',
  chainId: 11155111,
  isCorrectChain: true,
  switchToWriteChain: vi.fn(),
  simulationData: undefined as { request: typeof SIMULATION_REQUEST } | undefined,
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

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return { ...actual, keccak256: () => mocks.runtimeCodeHash }
})

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useReadContracts: (parameters: unknown) => {
    mocks.readParameters = parameters
    return {
      data: mocks.reads,
      error: mocks.readsError,
      isPending: mocks.readsPending,
      isFetching: mocks.readsFetching,
      refetch: mocks.refetchReads,
    }
  },
  useBlock: (parameters: unknown) => {
    mocks.blockParameters = parameters
    return {
      data: mocks.block,
      error: mocks.blockError,
      isPending: mocks.blockPending,
      isFetching: mocks.blockFetching,
      refetch: mocks.refetchBlock,
    }
  },
  useBytecode: (parameters: unknown) => {
    mocks.bytecodeParameters = parameters
    return {
      data: mocks.bytecode,
      error: mocks.bytecodeError,
      isPending: mocks.bytecodePending,
      isFetching: mocks.bytecodeFetching,
      refetch: mocks.refetchBytecode,
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

describe('Permit2ApprovalInventory', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.address = ACCOUNT
    mocks.reads = [
      { status: 'success', result: maxUint256 },
      { status: 'success', result: [BigInt(2_000_000), BigInt(3_000), BigInt(7)] },
    ]
    mocks.readsError = null
    mocks.readsPending = false
    mocks.readsFetching = false
    mocks.refetchReads.mockReset().mockResolvedValue(undefined)
    mocks.readParameters = undefined
    mocks.block = { timestamp: BigInt(2_000) }
    mocks.blockError = null
    mocks.blockPending = false
    mocks.blockFetching = false
    mocks.refetchBlock.mockReset().mockResolvedValue(undefined)
    mocks.blockParameters = undefined
    mocks.bytecode = '0x1234'
    mocks.bytecodeError = null
    mocks.bytecodePending = false
    mocks.bytecodeFetching = false
    mocks.refetchBytecode.mockReset().mockResolvedValue(undefined)
    mocks.bytecodeParameters = undefined
    mocks.runtimeCodeHash = EXPECTED_CODE_HASH
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

  it('reads both allowance layers for the connected account and verifies the deployment code', () => {
    render(<Permit2ApprovalInventory />)

    expect(screen.getByText('Permit2 双层权限')).toBeInTheDocument()
    expect(screen.getByText(/runtime code hash 已匹配/)).toHaveTextContent(EXPECTED_CODE_HASH)
    expect(screen.getByText('无限（uint256 最大值）')).toBeInTheDocument()
    expect(screen.getByText('2 USDC')).toBeInTheDocument()
    expect(screen.getByText('有效可执行额度：2 USDC')).toBeInTheDocument()
    expect(mocks.readParameters).toEqual(expect.objectContaining({
      allowFailure: true,
      query: { enabled: true },
      contracts: [
        expect.objectContaining({ address: TOKEN, functionName: 'allowance', args: [ACCOUNT, PERMIT2], chainId: 11155111 }),
        expect.objectContaining({ address: PERMIT2, functionName: 'allowance', args: [ACCOUNT, TOKEN, SPENDER], chainId: 11155111 }),
      ],
    }))
    expect(mocks.blockParameters).toEqual(expect.objectContaining({ chainId: 11155111, watch: true }))
    expect(mocks.bytecodeParameters).toEqual(expect.objectContaining({ address: PERMIT2, chainId: 11155111 }))
  })

  it('shows zero internal permission without hiding an unlimited root token approval', () => {
    mocks.reads = [
      { status: 'success', result: maxUint256 },
      { status: 'success', result: [BigInt(0), BigInt(0), BigInt(9)] },
    ]
    render(<Permit2ApprovalInventory />)

    expect(screen.getByText('该 Spender 的 Permit2 存储额度为 0。')).toBeInTheDocument()
    expect(screen.getByText(/uint256 最大额度是独立的底层授权/)).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('distinguishes expired and dormant internal permissions', () => {
    mocks.reads = [
      { status: 'success', result: maxUint256 },
      { status: 'success', result: [BigInt(1_000_000), BigInt(1_999), BigInt(1)] },
    ]
    const { rerender } = render(<Permit2ApprovalInventory />)
    expect(screen.getByText(/内部额度已过期/)).toBeInTheDocument()

    mocks.reads = [
      { status: 'success', result: BigInt(0) },
      { status: 'success', result: [BigInt(1_000_000), BigInt(3_000), BigInt(1)] },
    ]
    rerender(<Permit2ApprovalInventory />)
    expect(screen.getByText(/底层额度恢复后可能重新生效/)).toBeInTheDocument()
  })

  it('uses uint160 for an unlimited Permit2 amount', () => {
    mocks.reads = [
      { status: 'success', result: maxUint256 },
      { status: 'success', result: [maxUint160, BigInt(3_000), BigInt(1)] },
    ]
    render(<Permit2ApprovalInventory />)

    expect(screen.getByText('无限（uint160 最大值）')).toBeInTheDocument()
    expect(screen.getByText('有效可执行额度：无限')).toBeInTheDocument()
  })

  it('fails closed when runtime code does not match the chain-scoped registry', () => {
    mocks.runtimeCodeHash = `0x${'00'.repeat(32)}`
    render(<Permit2ApprovalInventory />)

    expect(screen.getByText(/合约身份或权限读取失败/)).toBeInTheDocument()
    expect(screen.queryByText(/有效可执行额度/)).not.toBeInTheDocument()
  })

  it('fails closed when a resolved deployment query has no contract bytecode', () => {
    mocks.bytecode = undefined
    mocks.bytecodePending = false
    render(<Permit2ApprovalInventory />)

    expect(screen.getByText(/合约身份或权限读取失败/)).toBeInTheDocument()
    expect(screen.queryByText(/有效可执行额度/)).not.toBeInTheDocument()
  })

  it('refreshes code, block time, and both allowance reads together', () => {
    render(<Permit2ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '刷新 Permit2 清单' }))
    expect(mocks.refetchReads).toHaveBeenCalledTimes(1)
    expect(mocks.refetchBlock).toHaveBeenCalledTimes(1)
    expect(mocks.refetchBytecode).toHaveBeenCalledTimes(1)
  })

  it('does not enable any chain query before a wallet account exists', () => {
    mocks.address = undefined
    mocks.reads = undefined
    mocks.block = undefined
    mocks.bytecode = undefined
    mocks.readsPending = true
    mocks.blockPending = true
    mocks.bytecodePending = true
    render(<Permit2ApprovalInventory />)

    expect(screen.getByText('连接钱包后查看已登记范围内的 Permit2 权限')).toBeInTheDocument()
    expect(mocks.readParameters).toEqual(expect.objectContaining({ query: { enabled: false } }))
    expect(mocks.blockParameters).toEqual(expect.objectContaining({ query: { enabled: false } }))
    expect(mocks.bytecodeParameters).toEqual(expect.objectContaining({ query: { enabled: false } }))
  })

  it('freezes a one-target lockdown review without writing on the first click', () => {
    render(<Permit2ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' }))

    expect(screen.getByText('Permit2 lockdown Review')).toBeInTheDocument()
    expect(screen.getByText(/本次选中的 1 个 token \/ spender/)).toBeInTheDocument()
    expect(screen.getByText(/不会清除 Token→Permit2/)).toBeInTheDocument()
    expect(screen.getByText('0 USDC')).toBeInTheDocument()
    expect(screen.getByText(/模拟通过/)).toBeInTheDocument()
    expect(mocks.writeContract).not.toHaveBeenCalled()
    expect(mocks.simulateParameters).toEqual(expect.objectContaining({
      address: PERMIT2,
      functionName: 'lockdown',
      args: [[{ token: TOKEN, spender: SPENDER }]],
      account: ACCOUNT,
      chainId: 11155111,
      query: { enabled: true, retry: false },
    }))
  })

  it('allows expired and dormant nonzero Permit2 storage to be cleared', () => {
    mocks.reads = [
      { status: 'success', result: maxUint256 },
      { status: 'success', result: [BigInt(2_000_000), BigInt(1_999), BigInt(7)] },
    ]
    const { rerender } = render(<Permit2ApprovalInventory />)
    expect(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' })).toBeEnabled()

    mocks.reads = [
      { status: 'success', result: BigInt(0) },
      { status: 'success', result: [BigInt(2_000_000), BigInt(3_000), BigInt(7)] },
    ]
    rerender(<Permit2ApprovalInventory />)
    expect(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' })).toBeEnabled()
  })

  it('submits the exact simulated lockdown and persists only after receiving a hash', async () => {
    mocks.writeContract.mockImplementation((_request, options) => options.onSuccess(LOCKDOWN_HASH))
    render(<Permit2ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并请求钱包' }))

    expect(mocks.writeContract).toHaveBeenCalledWith(SIMULATION_REQUEST, expect.any(Object))
    await waitFor(() => expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toContain(LOCKDOWN_HASH))
    expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toContain('sepolia-usdc-demo-spender-permit2')
    expect(mocks.receiptHash).toBe(LOCKDOWN_HASH)
  })

  it('requires the write chain while keeping the Permit2 inventory visible', () => {
    mocks.chainId = 1
    mocks.isCorrectChain = false
    render(<Permit2ApprovalInventory />)

    expect(screen.getByText('有效可执行额度：2 USDC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '切换到 Sepolia' }))
    expect(mocks.switchToWriteChain).toHaveBeenCalledTimes(1)
  })

  it('blocks the wallet request when lockdown simulation fails', () => {
    mocks.simulationData = undefined
    mocks.simulationError = new Error('execution reverted')
    render(<Permit2ApprovalInventory />)

    fireEvent.click(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' }))

    expect(screen.getByText(/lockdown 模拟失败/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认并请求钱包' })).toBeDisabled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('restores a pending lockdown and resumes its target-chain receipt query', async () => {
    seedPendingLockdown()
    mocks.isConfirming = true
    render(<Permit2ApprovalInventory />)

    expect(await screen.findByText('Permit2 撤销交易链上确认中…')).toBeInTheDocument()
    expect(mocks.receiptHash).toBe(LOCKDOWN_HASH)
    expect(mocks.receiptParameters).toEqual(expect.objectContaining({ chainId: 11155111 }))
    expect(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' })).toBeDisabled()
    expect(screen.getByRole('link', { name: '在区块浏览器查看 Permit2 撤销交易' })).toHaveAttribute(
      'href',
      `https://sepolia.etherscan.io/tx/${LOCKDOWN_HASH}`,
    )
  })

  it('discards a pending target that no longer exists in the registry', async () => {
    seedPendingLockdown(LOCKDOWN_HASH, 'removed-registry-target')
    render(<Permit2ApprovalInventory />)

    await waitFor(() => expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toBeNull())
    expect(mocks.receiptHash).toBeUndefined()
    expect(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' })).toBeEnabled()
  })

  it('keeps an unresolved hash locked and retries only receipt observation', async () => {
    seedPendingLockdown()
    mocks.receiptError = new Error('transport error')
    render(<Permit2ApprovalInventory />)

    expect(await screen.findByText(/Hash 已保留，不能再次提交/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新查询这笔 Permit2 撤销' }))
    expect(mocks.receiptRefetch).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toContain(LOCKDOWN_HASH)
    expect(screen.getByRole('button', { name: '准备清除 Permit2 内部授权' })).toBeDisabled()
  })

  it('clears persistence and verifies internal amount after a successful receipt', async () => {
    seedPendingLockdown()
    mocks.reads = [
      { status: 'success', result: maxUint256 },
      { status: 'success', result: [BigInt(0), BigInt(0), BigInt(8)] },
    ]
    mocks.isReceiptSuccess = true
    mocks.receiptData = { status: 'success' }
    render(<Permit2ApprovalInventory />)

    expect(await screen.findByText(/内部 amount 已归零/)).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toBeNull())
    expect(mocks.refetchReads).toHaveBeenCalledTimes(1)
    expect(mocks.refetchBlock).toHaveBeenCalledTimes(1)
    expect(mocks.refetchBytecode).toHaveBeenCalledTimes(1)
  })

  it('does not claim lockdown succeeded when the latest internal amount remains nonzero', async () => {
    seedPendingLockdown()
    mocks.isReceiptSuccess = true
    mocks.receiptData = { status: 'success' }
    render(<Permit2ApprovalInventory />)

    expect(await screen.findByText(/最新 Permit2 内部 amount 仍非零/)).toBeInTheDocument()
    expect(screen.queryByText(/内部 amount 已归零/)).not.toBeInTheDocument()
  })

  it('treats a reverted receipt as failure without successful refetch', async () => {
    seedPendingLockdown()
    mocks.isReceiptSuccess = true
    mocks.receiptData = { status: 'reverted' }
    render(<Permit2ApprovalInventory />)

    expect(await screen.findByText(/已上链但执行失败/)).toBeInTheDocument()
    expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toBeNull()
    expect(mocks.refetchReads).not.toHaveBeenCalled()
  })

  it('tracks a repriced lockdown and clears one cancelled by replacement', async () => {
    seedPendingLockdown()
    const { unmount } = render(<Permit2ApprovalInventory />)
    await waitFor(() => expect(mocks.receiptHash).toBe(LOCKDOWN_HASH))

    act(() => {
      mocks.replacementCallback?.({ reason: 'repriced', transaction: { hash: REPLACEMENT_HASH } })
    })
    expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toContain(REPLACEMENT_HASH)
    expect(screen.getByText(/加速了交易/)).toBeInTheDocument()

    unmount()
    seedPendingLockdown()
    render(<Permit2ApprovalInventory />)
    await waitFor(() => expect(mocks.receiptHash).toBe(LOCKDOWN_HASH))
    act(() => {
      mocks.replacementCallback?.({ reason: 'cancelled', transaction: { hash: REPLACEMENT_HASH } })
    })
    expect(localStorage.getItem(LOCKDOWN_STORAGE_KEY)).toBeNull()
    expect(screen.getByText(/取消原交易/)).toBeInTheDocument()
  })
})
