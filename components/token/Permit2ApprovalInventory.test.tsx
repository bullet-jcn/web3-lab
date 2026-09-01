import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maxUint160, maxUint256 } from 'viem'
import { Permit2ApprovalInventory } from './Permit2ApprovalInventory'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const TOKEN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
const SPENDER = '0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const EXPECTED_CODE_HASH = '0x96d9f5c3f0fb0423426b7f970186235b7347027f4e5c19c40c412b7d97fc3751'

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
}))

describe('Permit2ApprovalInventory', () => {
  beforeEach(() => {
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
})
