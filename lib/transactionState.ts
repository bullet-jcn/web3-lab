import type { ReplacementReason } from 'viem'

export type TransactionState =
  | 'idle'
  | 'awaiting-wallet'
  | 'confirming'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'replaced'

interface ResolveTransactionStateInput {
  isAwaitingWallet: boolean
  isConfirming: boolean
  isSuccess: boolean
  error: Error | null
  replacementReason?: ReplacementReason
}

export function resolveTransactionState({
  isAwaitingWallet,
  isConfirming,
  isSuccess,
  error,
  replacementReason,
}: ResolveTransactionStateInput): TransactionState {
  if (error) return 'error'
  if (replacementReason === 'cancelled') return 'cancelled'
  if (replacementReason === 'replaced') return 'replaced'
  if (isSuccess) return 'success'
  if (isConfirming) return 'confirming'
  if (isAwaitingWallet) return 'awaiting-wallet'
  return 'idle'
}

export function getReplacementMessage(reason: ReplacementReason | undefined): string | null {
  if (reason === 'repriced') return '你在钱包中加速了交易，系统已跟踪新的交易哈希。'
  if (reason === 'cancelled') return '你已在钱包中取消原交易，这次操作没有执行。'
  if (reason === 'replaced') return '原交易已被另一笔不同内容的交易替换，这次操作不能视为成功。'
  return null
}
