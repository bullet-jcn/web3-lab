import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSiweMessage } from 'viem/siwe'
import { useConnection, useSignMessage } from 'wagmi'

export function useSiwe() {
  const { address, chainId } = useConnection()
  const { mutateAsync: signMessageAsync } = useSignMessage()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!address || !chainId) {
        throw new Error('钱包未连接')
      }

      const nonceRes = await fetch('/api/auth/nonce')
      if (!nonceRes.ok) {
        const body = await nonceRes.json().catch(() => null)
        throw new Error(body?.error ?? '登录服务暂时不可用')
      }
      const { nonce } = await nonceRes.json()

      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: '1',
        statement: '登录 web3-lab',
      })

      const signature = await signMessageAsync({ message })

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })

      if (!verifyRes.ok) {
        const { error } = await verifyRes.json()
        throw new Error(error ?? '登录验证失败')
      }

      return verifyRes.json()
    },
    onSuccess: (data) => {
      queryClient.removeQueries({ queryKey: ['watchlist'] })
      queryClient.setQueryData(['session'], data)
    },
  })
}
