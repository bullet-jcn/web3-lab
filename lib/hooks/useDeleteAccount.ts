import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearBrowserServiceData } from '@/lib/accountDeletion'

export function useDeleteAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (confirmation: string) => {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? '删除账户数据失败')
      }
      return response.json() as Promise<{ deleted: true; onchainDataUnaffected: true }>
    },
    onSuccess: () => {
      if (typeof window !== 'undefined') clearBrowserServiceData(window.localStorage)
      queryClient.clear()
      queryClient.setQueryData(['session'], null)
    },
  })
}
