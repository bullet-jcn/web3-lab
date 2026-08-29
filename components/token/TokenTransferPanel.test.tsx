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
const TRANSFER_HASH = `0x${'01'.repeat(32)}` as Hash
const SEND_HASH = `0x${'02'.repeat(32)}` as Hash
const REPLACEMENT_HASH = `0x${'03'.repeat(32)}` as Hash

const mocks = vi.hoisted(() => ({
  receiptCallbacks: new Map<string, ReplacementCallback>(),
  confirmedHashes: new Set<string>(),
  writeContract: vi.fn(),
  sendTransaction: vi.fn(),
}))

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: ACCOUNT }),
  useReadContract: () => ({ data: BigInt(1) }),
  useSimulateContract: () => ({ error: null }),
  useWriteContract: () => ({ mutate: mocks.writeContract, isPending: false, error: null }),
  useSendTransaction: () => ({ mutate: mocks.sendTransaction, isPending: false, error: null }),
  useWaitForTransactionReceipt: (options: { hash?: string; onReplaced?: ReplacementCallback }) => {
    if (options.hash && options.onReplaced) mocks.receiptCallbacks.set(options.hash, options.onReplaced)
    return {
      isLoading: !!options.hash && !mocks.confirmedHashes.has(options.hash),
      isSuccess: !!options.hash && mocks.confirmedHashes.has(options.hash),
      error: null,
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
    mocks.writeContract.mockReset()
    mocks.sendTransaction.mockReset()
  })

  it('restores both transfer hashes and resumes receipt queries', async () => {
    seedPending('erc20-transfer', TRANSFER_HASH)
    seedPending('native-transfer', SEND_HASH)
    render(<TokenTransferPanel />)

    expect(await screen.findAllByText('链上确认中…')).toHaveLength(2)
    expect(mocks.receiptCallbacks.has(TRANSFER_HASH)).toBe(true)
    expect(mocks.receiptCallbacks.has(SEND_HASH)).toBe(true)
  })

  it('stores a submitted ERC-20 transfer under the current wallet context', async () => {
    mocks.writeContract.mockImplementation((_request, options) => options.onSuccess(TRANSFER_HASH))
    render(<TokenTransferPanel />)

    fireEvent.click(screen.getByRole('button', { name: '转账' }))

    await waitFor(() => expect(localStorage.getItem(storageKey('erc20-transfer'))).toContain(TRANSFER_HASH))
    expect(screen.getByText('链上确认中…')).toBeInTheDocument()
  })

  it('stores a submitted native transfer separately', async () => {
    mocks.sendTransaction.mockImplementation((_request, options) => options.onSuccess(SEND_HASH))
    render(<TokenTransferPanel />)

    fireEvent.change(screen.getByLabelText('ETH 收款地址'), { target: { value: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' } })
    fireEvent.change(screen.getByLabelText('ETH 数量'), { target: { value: '0.0001' } })
    fireEvent.click(screen.getByRole('button', { name: '发送ETH' }))

    await waitFor(() => expect(localStorage.getItem(storageKey('native-transfer'))).toContain(SEND_HASH))
    expect(localStorage.getItem(storageKey('erc20-transfer'))).toBeNull()
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
    expect(screen.getByRole('button', { name: '发送ETH' })).toBeDisabled()
    expect(mocks.sendTransaction).not.toHaveBeenCalled()
  })

  it('clears a restored transaction after confirmation', async () => {
    seedPending('erc20-transfer', TRANSFER_HASH)
    mocks.confirmedHashes.add(TRANSFER_HASH)
    render(<TokenTransferPanel />)

    expect(await screen.findByText('转账成功!')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(storageKey('erc20-transfer'))).toBeNull())
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
    expect(localStorage.getItem(storageKey('erc20-transfer'))).toContain(REPLACEMENT_HASH)
  })
})
