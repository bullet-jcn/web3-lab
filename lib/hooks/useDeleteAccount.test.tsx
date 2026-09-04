import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/accountDeletion'
import { useDeleteAccount } from './useDeleteAccount'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  localStorage.clear()
})

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  queryClient.setQueryData(['session'], { address: '0x1234' })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, ...renderHook(() => useDeleteAccount(), { wrapper }) }
}

describe('useDeleteAccount', () => {
  it('clears server session cache and application-owned browser records after deletion', async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json({
      deleted: true,
      onchainDataUnaffected: true,
    }))
    localStorage.setItem('web3-lab:risk-decisions:v1:1:account', 'record')
    localStorage.setItem('wallet-provider:connection', 'keep')
    const { result, queryClient } = setup()

    act(() => result.current.mutate(ACCOUNT_DELETION_CONFIRMATION))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(global.fetch).toHaveBeenCalledWith('/api/account', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ confirmation: ACCOUNT_DELETION_CONFIRMATION }),
    }))
    expect(queryClient.getQueryData(['session'])).toBeNull()
    expect(localStorage.getItem('web3-lab:risk-decisions:v1:1:account')).toBeNull()
    expect(localStorage.getItem('wallet-provider:connection')).toBe('keep')
  })

  it('preserves local recovery data when server deletion fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json(
      { error: '账户删除服务暂时不可用' },
      { status: 503 },
    ))
    localStorage.setItem('web3-lab:address-book:v1:1', 'record')
    const { result } = setup()

    act(() => result.current.mutate(ACCOUNT_DELETION_CONFIRMATION))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(localStorage.getItem('web3-lab:address-book:v1:1')).toBe('record')
  })
})
