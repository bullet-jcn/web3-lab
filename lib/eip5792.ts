
export function resolveAtomicSupport(status: 'supported' | 'ready' | 'unsupported' | undefined): 'atomic' | 'upgrade-then-atomic' | 'sequential-fallback' {
    if(status === 'supported') return 'atomic'
    if(status === 'ready') return 'upgrade-then-atomic'
    return 'sequential-fallback'
}

export type AtomicBatchState = 'idle' | 'awaiting-wallet' | 'confirming' | 'success' | 'failure'

interface ResolveAtomicBatchStateInput {
  isAwaitingWallet: boolean
  bundleId: string | undefined
  status: 'pending' | 'success' | 'failure' | undefined
  receiptStatuses: readonly ('success' | 'reverted')[]
  error: Error | null
}

export function resolveAtomicBatchState({
  isAwaitingWallet,
  bundleId,
  status,
  receiptStatuses,
  error,
}: ResolveAtomicBatchStateInput): AtomicBatchState {
  if (error || status === 'failure' || receiptStatuses.includes('reverted')) return 'failure'
  if (status === 'success') return 'success'
  if (isAwaitingWallet) return 'awaiting-wallet'
  if (bundleId) return 'confirming'
  return 'idle'
}
