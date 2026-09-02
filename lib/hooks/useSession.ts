import { useQuery } from "@tanstack/react-query"

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? '认证服务暂时不可用')
      }
      return res.json()
    },
  })
}
