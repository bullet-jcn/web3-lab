import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { sepolia } from 'viem/chains'
import { resolveErc20ApprovalSnapshots } from './approvalInventory'
import { listTrackedErc20ApprovalTargets } from './approvalRegistry'
import {
  createApprovalRevokeReview,
  getApprovalRevokeErrorMessage,
  isApprovalRevokeReviewCurrent,
} from './approvalRevoke'

const ACCOUNT = '0x0000000000000000000000000000000000000001' as Address
const OTHER_ACCOUNT = '0x0000000000000000000000000000000000000002' as Address
const targets = listTrackedErc20ApprovalTargets(sepolia.id)

function activeSnapshot(allowance = BigInt(1_500_000)) {
  return resolveErc20ApprovalSnapshots(targets, {
    status: 'success',
    results: [{ status: 'success', result: allowance }],
  })[0]!
}

describe('approval revoke review', () => {
  it('freezes the exact account, target, spender, and previous allowance', () => {
    const snapshot = activeSnapshot()
    const review = createApprovalRevokeReview(snapshot, ACCOUNT, 'Ethereum Sepolia')

    expect(review).toEqual(expect.objectContaining({
      kind: 'erc20-revoke',
      targetId: 'sepolia-usdc-demo-spender',
      account: ACCOUNT,
      chainId: sepolia.id,
      symbol: 'USDC',
      previousAllowance: BigInt(1_500_000),
      formattedPreviousAllowance: '1.5',
      wasUnlimited: false,
    }))
    expect(Object.isFrozen(review)).toBe(true)
  })

  it('does not create a revoke review for zero or unknown allowances', () => {
    const none = resolveErc20ApprovalSnapshots(targets, {
      status: 'success',
      results: [{ status: 'success', result: BigInt(0) }],
    })[0]!
    const failed = resolveErc20ApprovalSnapshots(targets, {
      status: 'success',
      results: [{ status: 'failure' }],
    })[0]!

    expect(createApprovalRevokeReview(none, ACCOUNT, 'Ethereum Sepolia')).toBeNull()
    expect(createApprovalRevokeReview(failed, ACCOUNT, 'Ethereum Sepolia')).toBeNull()
  })

  it('invalidates a review when its account, chain, allowance, or target evidence changes', () => {
    const snapshot = activeSnapshot()
    const review = createApprovalRevokeReview(snapshot, ACCOUNT, 'Ethereum Sepolia')!

    expect(isApprovalRevokeReviewCurrent(review, snapshot, ACCOUNT, sepolia.id)).toBe(true)
    expect(isApprovalRevokeReviewCurrent(review, snapshot, OTHER_ACCOUNT, sepolia.id)).toBe(false)
    expect(isApprovalRevokeReviewCurrent(review, snapshot, ACCOUNT, 1)).toBe(false)
    expect(isApprovalRevokeReviewCurrent(review, activeSnapshot(BigInt(2_000_000)), ACCOUNT, sepolia.id)).toBe(false)
    expect(isApprovalRevokeReviewCurrent(review, undefined, ACCOUNT, sepolia.id)).toBe(false)
  })

  it('uses revoke-specific deterministic wallet error messages', () => {
    expect(getApprovalRevokeErrorMessage(new Error('User rejected the request'))).toBe('你取消了撤销交易')
    expect(getApprovalRevokeErrorMessage(new Error('insufficient funds'))).toBe('Gas 不足，无法提交撤销交易')
    expect(getApprovalRevokeErrorMessage(new Error('execution reverted'))).toContain('原授权可能仍然有效')
    expect(getApprovalRevokeErrorMessage(new Error('transport failed'))).toBe('撤销交易提交失败，请重试')
  })
})
