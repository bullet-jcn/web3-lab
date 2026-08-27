import { useConnection } from 'wagmi'
import { resolveWalletSessionStatus } from '@/lib/auth/walletSession'
import { useSession } from './useSession'

export function useWalletSession() {
  const sessionQuery = useSession()
  const { address: walletAddress, chainId, isConnected } = useConnection()
  const status = resolveWalletSessionStatus(sessionQuery.data?.address, walletAddress)

  return {
    ...sessionQuery,
    session: sessionQuery.data,
    walletAddress,
    chainId,
    isConnected,
    status,
    isAuthenticatedWallet: status === 'matched',
  }
}
