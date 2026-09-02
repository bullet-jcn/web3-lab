import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? '登出失败')
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['session'], null)
      queryClient.removeQueries({ queryKey: ['watchlist'] })
    },
  })
}
