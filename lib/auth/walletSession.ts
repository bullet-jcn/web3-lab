import type { Address } from 'viem'

export type WalletSessionStatus =
  | 'signed-out'
  | 'wallet-disconnected'
  | 'matched'
  | 'account-mismatch'

export function resolveWalletSessionStatus(
  sessionAddress: Address | undefined,
  walletAddress: Address | undefined,
): WalletSessionStatus {
  if (!sessionAddress) return 'signed-out'
  if (!walletAddress) return 'wallet-disconnected'
  if (sessionAddress.toLowerCase() !== walletAddress.toLowerCase()) return 'account-mismatch'
  return 'matched'
}
