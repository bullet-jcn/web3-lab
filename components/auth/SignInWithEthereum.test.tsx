import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/accountDeletion'
import SignInWithEthereum from './SignInWithEthereum'

const ACCOUNT = '0x0000000000000000000000000000000000000001'
const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  resetDelete: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/hooks/useWalletSession', () => ({
  useWalletSession: () => ({
    session: { address: ACCOUNT },
    isConnected: true,
    status: 'matched',
    isLoading: false,
  }),
}))

vi.mock('@/lib/hooks/useSiwe', () => ({
  useSiwe: () => ({
    mutate: mocks.signIn,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('@/lib/hooks/useLogout', () => ({
  useLogout: () => ({ mutate: mocks.signOut, isPending: false }),
}))

vi.mock('@/lib/hooks/useDeleteAccount', () => ({
  useDeleteAccount: () => ({
    mutate: mocks.deleteAccount,
    reset: mocks.resetDelete,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

describe('SignInWithEthereum account deletion', () => {
  beforeEach(() => {
    mocks.deleteAccount.mockReset()
    mocks.resetDelete.mockReset()
  })

  it('requires exact explicit confirmation and states the onchain boundary', async () => {
    render(<SignInWithEthereum />)

    fireEvent.click(screen.getByRole('button', { name: '删除服务数据' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('公开区块链上的交易无法删除')

    const deleteButton = screen.getByRole('button', { name: '永久删除' })
    expect(deleteButton).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: '账户删除确认' }), {
      target: { value: ACCOUNT_DELETION_CONFIRMATION },
    })
    expect(deleteButton).toBeEnabled()

    fireEvent.click(deleteButton)
    expect(mocks.deleteAccount).toHaveBeenCalledWith(ACCOUNT_DELETION_CONFIRMATION)
  })
})
