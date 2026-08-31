import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenTransferPanel } from './TokenTransferPanel'

type Hash = `0x${string}`
type ReplacementCallback = (event: {
  reason: 'cancelled' | 'replaced' | 'repriced'
  transaction: { hash: Hash }
}) => void

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const CHAIN_ID = 11155111
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
const EXPLORER_URL = 'https://sepolia.etherscan.io/tx'
const TRANSFER_HASH = `0x${'01'.repeat(32)}` as Hash
const SEND_HASH = `0x${'02'.repeat(32)}` as Hash
const REPLACEMENT_HASH = `0x${'03'.repeat(32)}` as Hash

const mocks = vi.hoisted(() => ({
  receiptCallbacks: new Map<string, ReplacementCallback>(),
  confirmedHashes: new Set<string>(),
  receiptErrors: new Map<string, Error>(),
  refetchReceipt: vi.fn(),
  writeContract: vi.fn(),
  sendTransaction: vi.fn(),
  writeError: null as Error | null,
  sendError: null as Error | null,
  refetchTokenBalance: vi.fn(),
  refetchNativeBalance: vi.fn(),
  nativeBalance: BigInt('1000000000000000000'),
  tokenDecimals: 6,
}))

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: ACCOUNT }),
  useBalance: () => ({
    data: { value: mocks.nativeBalance, decimals: 18, symbol: 'ETH' },
    error: null,
    refetch: mocks.refetchNativeBalance,
  }),
  useEstimateGas: (options: { data?: string; value?: bigint }) => options.value !== undefined && options.value > mocks.nativeBalance
    ? { data: undefined, error: new Error('insufficient funds for gas estimate') }
    : { data: options.data ? BigInt(50_000) : BigInt(21_000), error: null },
  useEstimateFeesPerGas: () => ({
    data: { maxFeePerGas: BigInt(2_000_000_000), maxPriorityFeePerGas: BigInt(1_000_000_000) },
    error: null,
  }),
  useReadContract: (options: { functionName: string }) => ({
    data: options.functionName === 'decimals'
      ? mocks.tokenDecimals
      : BigInt(1_500_000),
    error: null,
    refetch: options.functionName === 'balanceOf' ? mocks.refetchTokenBalance : vi.fn(),
  }),
  useSimulateContract: () => ({ error: null }),
  useWriteContract: () => ({ mutate: mocks.writeContract, isPending: false, error: mocks.writeError }),
  useSendTransaction: () => ({ mutate: mocks.sendTransaction, isPending: false, error: mocks.sendError }),
  useWaitForTransactionReceipt: (options: { hash?: string; onReplaced?: ReplacementCallback }) => {
    if (options.hash && options.onReplaced) mocks.receiptCallbacks.set(options.hash, options.onReplaced)
    const error = options.hash ? mocks.receiptErrors.get(options.hash) ?? null : null
    return {
      isLoading: !!options.hash && !mocks.confirmedHashes.has(options.hash) && !error,
      isSuccess: !!options.hash && mocks.confirmedHashes.has(options.hash),
      error,
      refetch: () => mocks.refetchReceipt(options.hash),
      isRefetching: false,
    }
  },
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

function storageKey(kind: 'erc20-transfer' | 'native-transfer') {
  return `web3-lab:pending-tx:v1:${CHAIN_ID}:${ACCOUNT}:${kind}`
}

function seedPending(kind: 'erc20-transfer' | 'native-transfer', hash: Hash) {
  localStorage.setItem(storageKey(kind), JSON.stringify({
    version: 1,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    kind,
    hash,
    createdAt: Date.now(),
  }))
}

describe('TokenTransferPanel pending transactions', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.receiptCallbacks.clear()
    mocks.confirmedHashes.clear()
    mocks.receiptErrors.clear()
    mocks.refetchReceipt.mockReset()
    mocks.writeContract.mockReset()
    mocks.sendTransaction.mockReset()
    mocks.writeError = null
    mocks.sendError = null
    mocks.refetchTokenBalance.mockReset()
    mocks.refetchNativeBalance.mockReset()
    mocks.nativeBalance = BigInt('1000000000000000000')
    mocks.tokenDecimals = 6
  })

  it('restores both transfer hashes and resumes receipt queries', async () => {
    seedPending('erc20-transfer', TRANSFER_HASH)
    seedPending('native-transfer', SEND_HASH)
    render(<TokenTransferPanel />)

    expect(await screen.findAllByText('链上确认中…')).toHaveLength(2)
    expect(mocks.receiptCallbacks.has(TRANSFER_HASH)).toBe(true)
    expect(mocks.receiptCallbacks.has(SEND_HASH)).toBe(true)
  })

  it('keeps an ERC-20 hash locked and only retries its receipt query after an observation error', async () => {
    seedPending('erc20-transfer', TRANSFER_HASH)
    mocks.receiptErrors.set(TRANSFER_HASH, new Error('RPC unavailable'))
    render(<TokenTransferPanel />)

    expect(await screen.findByText('暂时无法查询链上状态，交易结果仍未知。请勿重新发送。')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('USDC 数量'), { target: { value: '1' } })

    expect(screen.getByRole('button', { name: '预览 ERC-20 转账' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '重新查询 ERC-20 交易状态' }))

    expect(mocks.refetchReceipt).toHaveBeenCalledWith(TRANSFER_HASH)
    expect(mocks.writeContract).not.toHaveBeenCalled()
    expect(localStorage.getItem(storageKey('erc20-transfer'))).toContain(TRANSFER_HASH)
  })

  it('keeps a native hash locked and only retries its receipt query after an observation error', async () => {
    seedPending('native-transfer', SEND_HASH)
    mocks.receiptErrors.set(SEND_HASH, new Error('RPC unavailable'))
    render(<TokenTransferPanel />)

    expect(await screen.findByText('暂时无法查询链上状态，交易结果仍未知。请勿重新发送。')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('ETH 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '0.1' } })

    expect(screen.getByRole('button', { name: '预览 ETH 转账' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '重新查询 ETH 交易状态' }))

    expect(mocks.refetchReceipt).toHaveBeenCalledWith(SEND_HASH)
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(localStorage.getItem(storageKey('native-transfer'))).toContain(SEND_HASH)
  })

  it('allows a fresh review when wallet submission failed before producing a hash', () => {
    mocks.writeError = new Error('User rejected the request')
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('USDC 数量'), { target: { value: '1' } })

    expect(screen.getByText('你取消了这笔交易')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ERC-20 转账' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '重新预览' })).toBeEnabled()
  })

  it('stores a submitted ERC-20 transfer under the current wallet context', async () => {
    mocks.writeContract.mockImplementation((_request, options) => options.onSuccess(TRANSFER_HASH))
    render(<TokenTransferPanel />)

    expect(screen.getByLabelText('ERC-20 资产')).toHaveValue('usdc')
    expect(screen.getByRole('option', { name: 'USDC — USD Coin' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('USDC 数量'), { target: { value: '1.25' } })
    fireEvent.click(screen.getByRole('button', { name: '预览 ERC-20 转账' }))
    expect(mocks.writeContract).not.toHaveBeenCalled()
    expect(screen.getByText('1.25 USDC')).toBeInTheDocument()
    expect(screen.getByText('1250000')).toBeInTheDocument()
    expect(screen.getByText('Gas 预算上限')).toBeInTheDocument()
    expect(screen.getByText('0.0001 ETH')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认并打开钱包' }))

    await waitFor(() => expect(localStorage.getItem(storageKey('erc20-transfer'))).toContain(TRANSFER_HASH))
    expect(screen.getByText('链上确认中…')).toBeInTheDocument()
    const explorerLink = screen.getByRole('link', { name: `查看 ERC-20 交易 ${TRANSFER_HASH}` })
    expect(explorerLink).toHaveAttribute('href', `${EXPLORER_URL}/${TRANSFER_HASH}`)
    expect(explorerLink).toHaveAttribute('target', '_blank')
    expect(explorerLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(mocks.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      address: USDC_ADDRESS,
      functionName: 'transfer',
      args: ['0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE', BigInt(1_250_000)],
    }), expect.any(Object))
  })

  it('fails closed when the asset selector does not resolve through the Registry', () => {
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ERC-20 资产'), { target: { value: 'attacker-controlled-address' } })
    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('ERC-20 数量'), { target: { value: '1' } })

    expect(screen.getByText('当前没有可用的受支持资产')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ERC-20 转账' })).toBeDisabled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('blocks the transfer when onchain decimals do not match the Registry', () => {
    mocks.tokenDecimals = 18
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('USDC 数量'), { target: { value: '1' } })

    expect(screen.getByText('链上代币精度与 Registry 不一致，已阻止转账')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ERC-20 转账' })).toBeDisabled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('shows formatted token balance and blocks excess precision', () => {
    render(<TokenTransferPanel />)

    expect(screen.getByText('USDC 余额: 1.5')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('USDC 数量'), { target: { value: '0.0000001' } })

    expect(screen.getByText('请输入最多 6 位小数的正数')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ERC-20 转账' })).toBeDisabled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('fills the exact ERC-20 balance without using floating point math', () => {
    render(<TokenTransferPanel />)

    fireEvent.click(screen.getByRole('button', { name: '填写最大 USDC 数量' }))

    expect(screen.getByLabelText('USDC 数量')).toHaveValue('1.5')
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('blocks an ERC-20 amount above the current account balance', () => {
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('USDC 数量'), { target: { value: '1.500001' } })

    expect(screen.getByText('余额不足，当前可用 1.5 USDC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ERC-20 转账' })).toBeDisabled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('blocks ERC-20 review when ETH cannot cover contract-call gas', () => {
    mocks.nativeBalance = BigInt('50000000000000')
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ERC-20 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('USDC 数量'), { target: { value: '1' } })

    expect(screen.getByText('ERC-20 预留最高 Gas 成本: 0.0001 ETH')).toBeInTheDocument()
    expect(screen.getByText('ETH 不足以支付 ERC-20 Gas，预算还差 0.00005 ETH')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ERC-20 转账' })).toBeDisabled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('stores a submitted native transfer separately', async () => {
    mocks.sendTransaction.mockImplementation((_request, options) => options.onSuccess(SEND_HASH))
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ETH 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '0.0001' } })
    fireEvent.click(screen.getByRole('button', { name: '预览 ETH 转账' }))
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
    expect(screen.getByText('0.0001 ETH')).toBeInTheDocument()
    expect(screen.getByText('100000000000000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认并打开钱包' }))

    await waitFor(() => expect(localStorage.getItem(storageKey('native-transfer'))).toContain(SEND_HASH))
    expect(localStorage.getItem(storageKey('erc20-transfer'))).toBeNull()
    expect(screen.getByRole('link', { name: `查看 ETH 交易 ${SEND_HASH}` })).toHaveAttribute(
      'href',
      `${EXPLORER_URL}/${SEND_HASH}`,
    )
    expect(mocks.sendTransaction).toHaveBeenCalledWith({
      to: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE',
      value: BigInt('100000000000000'),
    }, expect.any(Object))
  })

  it('blocks invalid native transfer input before the wallet request', () => {
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ETH 收款地址'), { target: { value: 'not-an-address' } })
    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '0' } })

    expect(screen.getByText('请输入有效的 EVM 地址')).toBeInTheDocument()
    expect(screen.getByText('转账数量必须大于 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ETH 转账' })).toBeDisabled()
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
  })

  it('reserves max gas cost before allowing a native transfer', () => {
    render(<TokenTransferPanel />)

    expect(screen.getByText('ETH 余额: 1')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('ETH 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '0.99999' } })

    expect(screen.getByText('预留最高 Gas 成本: 0.000042 ETH')).toBeInTheDocument()
    expect(screen.getByText('ETH 余额不足，转账金额加 Gas 预算还差 0.000032 ETH')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 ETH 转账' })).toBeDisabled()
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
  })

  it('subtracts the gas limit before filling the maximum native amount', () => {
    render(<TokenTransferPanel />)

    const maxButton = screen.getByRole('button', { name: '填写最大 ETH 数量' })
    expect(maxButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('ETH 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '2' } })
    expect(maxButton).toBeEnabled()
    fireEvent.click(maxButton)

    expect(screen.getByLabelText('ETH 数量')).toHaveValue('0.999958')
    expect(screen.getByText('预留最高 Gas 成本: 0.000042 ETH')).toBeInTheDocument()
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
  })

  it('discards a review snapshot when the editable input changes', () => {
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ETH 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '0.1' } })
    fireEvent.click(screen.getByRole('button', { name: '预览 ETH 转账' }))
    expect(screen.getByText('确认转账详情')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '0.2' } })

    expect(screen.queryByText('确认转账详情')).not.toBeInTheDocument()
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
  })

  it('clears a restored transaction after confirmation', async () => {
    seedPending('erc20-transfer', TRANSFER_HASH)
    mocks.confirmedHashes.add(TRANSFER_HASH)
    render(<TokenTransferPanel />)

    expect(await screen.findByText('转账成功!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `查看已确认 ERC-20 交易 ${TRANSFER_HASH}` })).toHaveAttribute(
      'href',
      `${EXPLORER_URL}/${TRANSFER_HASH}`,
    )
    await waitFor(() => expect(localStorage.getItem(storageKey('erc20-transfer'))).toBeNull())
    expect(mocks.refetchTokenBalance).toHaveBeenCalled()
    expect(mocks.refetchNativeBalance).toHaveBeenCalled()
  })

  it('refreshes native balance after a restored send confirms', async () => {
    seedPending('native-transfer', SEND_HASH)
    mocks.confirmedHashes.add(SEND_HASH)
    render(<TokenTransferPanel />)

    expect(await screen.findByText('发送成功!')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(storageKey('native-transfer'))).toBeNull())
    expect(mocks.refetchNativeBalance).toHaveBeenCalled()
  })

  it('clears storage and removes success when the original transfer is cancelled', async () => {
    seedPending('erc20-transfer', TRANSFER_HASH)
    mocks.confirmedHashes.add(TRANSFER_HASH)
    render(<TokenTransferPanel />)
    expect(await screen.findByText('转账成功!')).toBeInTheDocument()

    act(() => {
      mocks.receiptCallbacks.get(TRANSFER_HASH)?.({ reason: 'cancelled', transaction: { hash: REPLACEMENT_HASH } })
    })

    expect(screen.queryByText('转账成功!')).not.toBeInTheDocument()
    expect(screen.getByText(/取消原交易/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `查看 ERC-20 替换交易 ${REPLACEMENT_HASH}` })).toHaveAttribute(
      'href',
      `${EXPLORER_URL}/${REPLACEMENT_HASH}`,
    )
    expect(localStorage.getItem(storageKey('erc20-transfer'))).toBeNull()
  })

  it('stores the replacement hash when a transaction is repriced', async () => {
    seedPending('erc20-transfer', TRANSFER_HASH)
    mocks.confirmedHashes.add(TRANSFER_HASH)
    render(<TokenTransferPanel />)
    expect(await screen.findByText('转账成功!')).toBeInTheDocument()

    act(() => {
      mocks.receiptCallbacks.get(TRANSFER_HASH)?.({ reason: 'repriced', transaction: { hash: REPLACEMENT_HASH } })
    })

    expect(screen.getByText(/加速了交易/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `查看 ERC-20 替换交易 ${REPLACEMENT_HASH}` })).toHaveAttribute(
      'href',
      `${EXPLORER_URL}/${REPLACEMENT_HASH}`,
    )
    expect(localStorage.getItem(storageKey('erc20-transfer'))).toContain(REPLACEMENT_HASH)
  })
})
