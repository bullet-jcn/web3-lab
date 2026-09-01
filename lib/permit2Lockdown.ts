import type { Address } from 'viem'
import type { Permit2AllowanceSnapshot } from './permit2Inventory'
import { getTrackedPermit2AllowanceTarget } from './permit2Registry'

export interface Permit2LockdownReview {
  readonly kind: 'permit2-lockdown'
  readonly targetId: string
  readonly account: Address
  readonly chainId: number
  readonly chainName: string
  readonly permit2Address: Address
  readonly tokenAddress: Address
  readonly tokenName: string
  readonly symbol: string
  readonly spender: Address
  readonly spenderLabel: string
  readonly previousTokenAllowanceToPermit2: bigint
  readonly previousAmount: bigint
  readonly formattedPreviousAmount: string
  readonly previousExpiration: bigint
  readonly previousNonce: bigint
  readonly previousState: 'active' | 'expired' | 'dormant'
}

function isRevocableSnapshot(
  snapshot: Permit2AllowanceSnapshot,
): snapshot is Extract<Permit2AllowanceSnapshot, { state: 'active' | 'expired' | 'dormant' }> {
  return (snapshot.state === 'active' || snapshot.state === 'expired' || snapshot.state === 'dormant')
    && snapshot.amount > BigInt(0)
}

export function createPermit2LockdownReview(
  snapshot: Permit2AllowanceSnapshot,
  account: Address,
  chainName: string,
): Permit2LockdownReview | null {
  if (!isRevocableSnapshot(snapshot)) return null

  return Object.freeze({
    kind: 'permit2-lockdown',
    targetId: snapshot.target.id,
    account,
    chainId: snapshot.target.chainId,
    chainName,
    permit2Address: snapshot.target.permit2Address,
    tokenAddress: snapshot.target.asset.address,
    tokenName: snapshot.target.asset.name,
    symbol: snapshot.target.asset.symbol,
    spender: snapshot.target.spender,
    spenderLabel: snapshot.target.spenderLabel,
    previousTokenAllowanceToPermit2: snapshot.tokenAllowanceToPermit2,
    previousAmount: snapshot.amount,
    formattedPreviousAmount: snapshot.formattedAmount,
    previousExpiration: snapshot.expiration,
    previousNonce: snapshot.nonce,
    previousState: snapshot.state,
  })
}

export function isPermit2LockdownReviewCurrent(
  review: Permit2LockdownReview,
  snapshot: Permit2AllowanceSnapshot | undefined,
  account: Address | undefined,
  activeChainId: number | undefined,
): boolean {
  if (!account || account.toLowerCase() !== review.account.toLowerCase()) return false
  if (activeChainId !== review.chainId || !snapshot || !isRevocableSnapshot(snapshot)) return false
  if (snapshot.target.id !== review.targetId || snapshot.target.chainId !== review.chainId) return false
  if (snapshot.target.permit2Address !== review.permit2Address
    || snapshot.target.asset.address !== review.tokenAddress
    || snapshot.target.spender !== review.spender) return false
  if (snapshot.tokenAllowanceToPermit2 !== review.previousTokenAllowanceToPermit2
    || snapshot.amount !== review.previousAmount
    || snapshot.expiration !== review.previousExpiration
    || snapshot.nonce !== review.previousNonce
    || snapshot.state !== review.previousState) return false

  const registeredTarget = getTrackedPermit2AllowanceTarget(review.chainId, review.targetId)
  return registeredTarget?.permit2Address === review.permit2Address
    && registeredTarget.asset.address === review.tokenAddress
    && registeredTarget.spender === review.spender
}

export function getPermit2LockdownErrorMessage(error: Error | null): string | null {
  if (!error) return null
  if (error.message.includes('User rejected') || error.message.includes('User denied')) {
    return '你取消了 Permit2 撤销交易'
  }
  if (error.message.includes('insufficient funds')) {
    return 'Gas 不足，无法提交 Permit2 撤销交易'
  }
  if (error.message.includes('reverted')) {
    return 'Permit2 合约拒绝了 lockdown，内部授权可能仍然有效'
  }
  return 'Permit2 撤销交易提交失败，请重试'
}
