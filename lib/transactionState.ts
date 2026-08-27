export type TransactionState = 'idle' | 'awaiting-wallet' | 'confirming' | 'success' | 'error'

interface ResolveTransactionStateInput {
  isAwaitingWallet: boolean
  isConfirming: boolean
  isSuccess: boolean
  error: Error | null
}

export function resolveTransactionState({
  isAwaitingWallet,
  isConfirming,
  isSuccess,
  error,
}: ResolveTransactionStateInput): TransactionState {
  if (error) return 'error'
  if (isSuccess) return 'success'
  if (isConfirming) return 'confirming'
  if (isAwaitingWallet) return 'awaiting-wallet'
  return 'idle'
}
