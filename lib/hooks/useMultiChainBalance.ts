import { useQueries } from '@tanstack/react-query'
import { formatEther, type Address } from 'viem'
import { ACTIVE_CHAINS, type ChainBalanceConfig } from '@/lib/chains'

export interface ChainBalance {
  id: string
  name: string
  chainId: number
  balance: string | null
  isLoading: boolean
  error: string | null
}

export function useMultiChainBalance(
  address: Address | undefined,
  chains: readonly ChainBalanceConfig[] = ACTIVE_CHAINS,
): ChainBalance[] {
  const results = useQueries({
    queries: chains.map((chain) => ({
      queryKey: ['balance', chain.id, address] as const,
      queryFn: () => chain.client.getBalance({ address: address as Address }),
      enabled: !!address,
      select: formatEther
    })),
  })

  return chains.map((chain, index) => {
    const result = results[index]
    return {
      id: chain.id,
      name: chain.name,
      chainId: chain.chainId,
      balance: result.data ?? null,
      isLoading: result.isLoading,
      error: result.error ? '读取余额失败，请稍后重试' : null,
    }
  })
}
