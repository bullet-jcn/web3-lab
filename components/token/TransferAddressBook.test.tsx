import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addressBookStorageKey } from '@/lib/addressBookStorage'
import { TransferAddressBook } from './TransferAddressBook'

const CHAIN_ID = 11155111
const ADDRESS = '0x8f7b86fe8f1a5cab00aa66cbb3e3bbf6a79535ee'
const CHECKSUM_ADDRESS = '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE'

describe('TransferAddressBook', () => {
  beforeEach(() => localStorage.clear())

  it('persists a validated contact and selects it for either transfer form', async () => {
    const onSelectErc20 = vi.fn()
    const onSelectNative = vi.fn()
    render(
      <TransferAddressBook
        chainId={CHAIN_ID}
        chainName="Ethereum Sepolia"
        selectionDisabled={false}
        onSelectErc20={onSelectErc20}
        onSelectNative={onSelectNative}
      />,
    )
    await screen.findByText('当前链还没有联系人。')

    fireEvent.change(screen.getByLabelText('联系人名称'), { target: { value: ' Alice ' } })
    fireEvent.change(screen.getByLabelText('联系人地址'), { target: { value: ADDRESS } })
    fireEvent.click(screen.getByRole('button', { name: '保存联系人' }))

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(localStorage.getItem(addressBookStorageKey(CHAIN_ID))).toContain(CHECKSUM_ADDRESS)
    fireEvent.click(screen.getByRole('button', { name: '将 Alice 用于 ERC-20' }))
    fireEvent.click(screen.getByRole('button', { name: '将 Alice 用于 ETH' }))
    expect(onSelectErc20).toHaveBeenCalledWith(CHECKSUM_ADDRESS)
    expect(onSelectNative).toHaveBeenCalledWith(CHECKSUM_ADDRESS)
  })

  it('does not expose contacts from another chain and reloads on a chain change', async () => {
    localStorage.setItem(addressBookStorageKey(CHAIN_ID), JSON.stringify({
      version: 1,
      chainId: CHAIN_ID,
      entries: [{ name: 'Alice', address: CHECKSUM_ADDRESS }],
    }))
    const props = {
      chainName: 'Ethereum Sepolia',
      selectionDisabled: false,
      onSelectErc20: vi.fn(),
      onSelectNative: vi.fn(),
    }
    const { rerender } = render(<TransferAddressBook {...props} chainId={CHAIN_ID} />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()

    rerender(<TransferAddressBook {...props} chainId={84532} chainName="Base Sepolia" />)
    await waitFor(() => expect(screen.queryByText('Alice')).not.toBeInTheDocument())
    expect(screen.getByText('当前链还没有联系人。')).toBeInTheDocument()
  })

  it('shows validation errors and never persists an invalid address', async () => {
    render(
      <TransferAddressBook
        chainId={CHAIN_ID}
        chainName="Ethereum Sepolia"
        selectionDisabled={false}
        onSelectErc20={vi.fn()}
        onSelectNative={vi.fn()}
      />,
    )
    await screen.findByText('当前链还没有联系人。')
    fireEvent.change(screen.getByLabelText('联系人名称'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('联系人地址'), { target: { value: 'not-an-address' } })
    fireEvent.click(screen.getByRole('button', { name: '保存联系人' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请输入有效的 EVM 地址')
    expect(localStorage.getItem(addressBookStorageKey(CHAIN_ID))).toBeNull()
  })

  it('disables selection while a transaction is unresolved but still allows deletion', async () => {
    localStorage.setItem(addressBookStorageKey(CHAIN_ID), JSON.stringify({
      version: 1,
      chainId: CHAIN_ID,
      entries: [{ name: 'Alice', address: CHECKSUM_ADDRESS }],
    }))
    render(
      <TransferAddressBook
        chainId={CHAIN_ID}
        chainName="Ethereum Sepolia"
        selectionDisabled
        onSelectErc20={vi.fn()}
        onSelectNative={vi.fn()}
      />,
    )

    expect(await screen.findByRole('button', { name: '将 Alice 用于 ERC-20' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '将 Alice 用于 ETH' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '删除联系人 Alice' }))
    expect(await screen.findByText('当前链还没有联系人。')).toBeInTheDocument()
    expect(localStorage.getItem(addressBookStorageKey(CHAIN_ID))).toBeNull()
  })

  it('fails closed and reports corrupted persisted data', async () => {
    localStorage.setItem(addressBookStorageKey(CHAIN_ID), '{bad json')
    render(
      <TransferAddressBook
        chainId={CHAIN_ID}
        chainName="Ethereum Sepolia"
        selectionDisabled={false}
        onSelectErc20={vi.fn()}
        onSelectNative={vi.fn()}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('地址簿数据已损坏或版本不受支持，已忽略')
    expect(localStorage.getItem(addressBookStorageKey(CHAIN_ID))).toBeNull()
  })
})
