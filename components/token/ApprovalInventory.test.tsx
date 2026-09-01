import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maxUint256 } from 'viem'
import { ApprovalInventory } from './ApprovalInventory'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const TOKEN = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
const SPENDER = '0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b'

const mocks = vi.hoisted(() => ({
  address: '0x0000000000000000000000000000000000000001' as `0x${string}` | undefined,
  data: [{ status: 'success', result: BigInt(1_500_000) }] as readonly unknown[] | undefined,
  error: null as Error | null,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
  readParameters: undefined as unknown,
}))

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
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
}))

describe('ApprovalInventory', () => {
  beforeEach(() => {
    mocks.address = ACCOUNT
    mocks.data = [{ status: 'success', result: BigInt(1_500_000) }]
    mocks.error = null
    mocks.isPending = false
    mocks.isFetching = false
    mocks.refetch.mockReset()
    mocks.readParameters = undefined
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
})
