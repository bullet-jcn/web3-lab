import type { Address } from 'viem'
import type { Erc20ApprovalSnapshot } from './approvalInventory'
import { getTrackedErc20ApprovalTarget } from './approvalRegistry'

export interface ApprovalRevokeReview {
  readonly kind: 'erc20-revoke'
  readonly targetId: string
  readonly account: Address
  readonly chainId: number
  readonly chainName: string
  readonly tokenAddress: Address
  readonly tokenName: string
  readonly symbol: string
  readonly spender: Address
  readonly spenderLabel: string
  readonly previousAllowance: bigint
  readonly formattedPreviousAllowance: string
  readonly wasUnlimited: boolean
}

export function createApprovalRevokeReview(
  snapshot: Erc20ApprovalSnapshot,
  account: Address,
  chainName: string,
): ApprovalRevokeReview | null {
  if (snapshot.state !== 'active') return null

  return Object.freeze({
    kind: 'erc20-revoke',
    targetId: snapshot.target.id,
    account,
    chainId: snapshot.target.chainId,
    chainName,
    tokenAddress: snapshot.target.asset.address,
    tokenName: snapshot.target.asset.name,
    symbol: snapshot.target.asset.symbol,
    spender: snapshot.target.spender,
    spenderLabel: snapshot.target.spenderLabel,
    previousAllowance: snapshot.allowance,
    formattedPreviousAllowance: snapshot.formattedAllowance,
    wasUnlimited: snapshot.isUnlimited,
  })
}

export function isApprovalRevokeReviewCurrent(
  review: ApprovalRevokeReview,
  snapshot: Erc20ApprovalSnapshot | undefined,
  account: Address | undefined,
  activeChainId: number | undefined,
): boolean {
  if (!account || account.toLowerCase() !== review.account.toLowerCase()) return false
  if (activeChainId !== review.chainId || snapshot?.state !== 'active') return false
  if (snapshot.target.id !== review.targetId || snapshot.target.chainId !== review.chainId) return false
  if (snapshot.target.asset.address !== review.tokenAddress || snapshot.target.spender !== review.spender) return false
  if (snapshot.allowance !== review.previousAllowance) return false

  const registeredTarget = getTrackedErc20ApprovalTarget(review.chainId, review.targetId)
  return registeredTarget?.asset.address === review.tokenAddress
    && registeredTarget.spender === review.spender
}

export function getApprovalRevokeErrorMessage(error: Error | null): string | null {
  if (!error) return null
  if (error.message.includes('User rejected') || error.message.includes('User denied')) {
    return '你取消了撤销交易'
  }
  if (error.message.includes('insufficient funds')) {
    return 'Gas 不足，无法提交撤销交易'
  }
  if (error.message.includes('reverted')) {
    return '合约拒绝了撤销操作，原授权可能仍然有效'
  }
  return '撤销交易提交失败，请重试'
}
