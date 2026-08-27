'use client'

import { useConnection, useSwitchChain } from 'wagmi'
import { isWriteChain, WRITE_CHAIN } from '@/lib/chains'

export function useWriteChainGuard() {
  const { chainId } = useConnection()
  const switchChain = useSwitchChain()

  return {
    chainId,
    writeChain: WRITE_CHAIN,
    isCorrectChain: isWriteChain(chainId),
    switchToWriteChain: () => switchChain.mutate({ chainId: WRITE_CHAIN.id }),
    isSwitchingChain: switchChain.isPending,
    switchChainError: switchChain.error,
  }
}
