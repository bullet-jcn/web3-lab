import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { sepolia } from 'viem/chains'
import { resolvePermit2AllowanceSnapshots } from './permit2Inventory'
import { listTrackedPermit2AllowanceTargets } from './permit2Registry'
import {
  createPermit2LockdownReview,
  getPermit2LockdownErrorMessage,
  isPermit2LockdownReviewCurrent,
} from './permit2Lockdown'

const ACCOUNT = '0x0000000000000000000000000000000000000001' as Address
const OTHER_ACCOUNT = '0x0000000000000000000000000000000000000002' as Address
const targets = listTrackedPermit2AllowanceTargets(sepolia.id)

function snapshot(
  tokenAllowance = BigInt(5_000_000),
  amount = BigInt(2_000_000),
  expiration = BigInt(3_000),
  nonce = BigInt(7),
  observedAt = BigInt(2_000),
) {
  return resolvePermit2AllowanceSnapshots(targets, {
    status: 'success',
    observedAt,
    results: [
      { status: 'success', result: tokenAllowance },
      { status: 'success', result: [amount, expiration, nonce] },
    ],
  })[0]!
}

describe('Permit2 lockdown review', () => {
  it('freezes both allowance layers and the exact Permit2 tuple', () => {
    const current = snapshot()
    const review = createPermit2LockdownReview(current, ACCOUNT, 'Sepolia')

    expect(review).toEqual(expect.objectContaining({
      kind: 'permit2-lockdown',
      targetId: 'sepolia-usdc-demo-spender-permit2',
      account: ACCOUNT,
      chainId: sepolia.id,
      previousTokenAllowanceToPermit2: BigInt(5_000_000),
      previousAmount: BigInt(2_000_000),
      previousExpiration: BigInt(3_000),
      previousNonce: BigInt(7),
      previousState: 'active',
    }))
    expect(Object.isFrozen(review)).toBe(true)
  })

  it('allows persistent nonzero expired and dormant entries to be cleared', () => {
    const expired = snapshot(BigInt(5_000_000), BigInt(2_000_000), BigInt(1_999))
    const dormant = snapshot(BigInt(0), BigInt(2_000_000))

    expect(createPermit2LockdownReview(expired, ACCOUNT, 'Sepolia')?.previousState).toBe('expired')
    expect(createPermit2LockdownReview(dormant, ACCOUNT, 'Sepolia')?.previousState).toBe('dormant')
  })

  it('does not create a review for zero, loading, or failed entries', () => {
    const none = snapshot(BigInt(5_000_000), BigInt(0))
    const loading = resolvePermit2AllowanceSnapshots(targets, { status: 'loading' })[0]!
    const failed = resolvePermit2AllowanceSnapshots(targets, { status: 'error' })[0]!

    expect(createPermit2LockdownReview(none, ACCOUNT, 'Sepolia')).toBeNull()
    expect(createPermit2LockdownReview(loading, ACCOUNT, 'Sepolia')).toBeNull()
    expect(createPermit2LockdownReview(failed, ACCOUNT, 'Sepolia')).toBeNull()
  })

  it('invalidates the review when wallet context or either allowance layer changes', () => {
    const current = snapshot()
    const review = createPermit2LockdownReview(current, ACCOUNT, 'Sepolia')!

    expect(isPermit2LockdownReviewCurrent(review, current, ACCOUNT, sepolia.id)).toBe(true)
    expect(isPermit2LockdownReviewCurrent(review, current, OTHER_ACCOUNT, sepolia.id)).toBe(false)
    expect(isPermit2LockdownReviewCurrent(review, current, ACCOUNT, 1)).toBe(false)
    expect(isPermit2LockdownReviewCurrent(review, snapshot(BigInt(4_000_000)), ACCOUNT, sepolia.id)).toBe(false)
    expect(isPermit2LockdownReviewCurrent(review, snapshot(BigInt(5_000_000), BigInt(3_000_000)), ACCOUNT, sepolia.id)).toBe(false)
    expect(isPermit2LockdownReviewCurrent(review, undefined, ACCOUNT, sepolia.id)).toBe(false)
  })

  it('uses deterministic Permit2-specific wallet errors', () => {
    expect(getPermit2LockdownErrorMessage(new Error('User rejected the request'))).toBe('你取消了 Permit2 撤销交易')
    expect(getPermit2LockdownErrorMessage(new Error('insufficient funds'))).toContain('Gas 不足')
    expect(getPermit2LockdownErrorMessage(new Error('execution reverted'))).toContain('内部授权可能仍然有效')
    expect(getPermit2LockdownErrorMessage(new Error('transport failed'))).toBe('Permit2 撤销交易提交失败，请重试')
  })
})
