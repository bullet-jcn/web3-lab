import { describe, expect, it } from 'vitest'
import { maxUint48, maxUint160, maxUint256 } from 'viem'
import { sepolia } from 'viem/chains'
import { listTrackedPermit2AllowanceTargets } from './permit2Registry'
import { formatPermit2Expiration, resolvePermit2AllowanceSnapshots } from './permit2Inventory'

const targets = listTrackedPermit2AllowanceTargets(sepolia.id)

function successState(tokenAllowance: bigint, amount: bigint, expiration: bigint, nonce = BigInt(0), observedAt = BigInt(1_000)) {
  return {
    status: 'success' as const,
    observedAt,
    results: [
      { status: 'success' as const, result: tokenAllowance },
      { status: 'success' as const, result: [amount, expiration, nonce] },
    ],
  }
}

describe('Permit2 allowance snapshots', () => {
  it('keeps loading and query failures distinct', () => {
    expect(resolvePermit2AllowanceSnapshots(targets, { status: 'loading' })[0]?.state).toBe('loading')
    expect(resolvePermit2AllowanceSnapshots(targets, { status: 'error' })[0]?.state).toBe('error')
  })

  it('classifies a zero Permit2 amount as no spender permission while preserving the root layer', () => {
    expect(resolvePermit2AllowanceSnapshots(
      targets,
      successState(maxUint256, BigInt(0), BigInt(0), BigInt(7)),
    )[0]).toEqual(expect.objectContaining({
      state: 'none',
      tokenAllowanceToPermit2: maxUint256,
      amount: BigInt(0),
      nonce: BigInt(7),
      isTokenAllowanceUnlimited: true,
    }))
  })

  it('uses the target-chain timestamp and treats equality as not yet expired', () => {
    expect(resolvePermit2AllowanceSnapshots(
      targets,
      successState(maxUint256, BigInt(1_000_000), BigInt(1_000), BigInt(0), BigInt(1_000)),
    )[0]?.state).toBe('active')
    expect(resolvePermit2AllowanceSnapshots(
      targets,
      successState(maxUint256, BigInt(1_000_000), BigInt(999), BigInt(0), BigInt(1_000)),
    )[0]?.state).toBe('expired')
  })

  it('keeps an unexpired internal permission visible when its root ERC-20 allowance is zero', () => {
    expect(resolvePermit2AllowanceSnapshots(
      targets,
      successState(BigInt(0), BigInt(2_000_000), BigInt(2_000)),
    )[0]).toEqual(expect.objectContaining({
      state: 'dormant',
      amount: BigInt(2_000_000),
      tokenAllowanceToPermit2: BigInt(0),
    }))
  })

  it('computes effective permission as the lower of the two allowance layers', () => {
    expect(resolvePermit2AllowanceSnapshots(
      targets,
      successState(BigInt(1_500_000), BigInt(2_000_000), BigInt(2_000)),
    )[0]).toEqual(expect.objectContaining({
      state: 'active',
      formattedAmount: '2',
      effectiveAmount: BigInt(1_500_000),
      formattedEffectiveAmount: '1.5',
    }))
  })

  it('uses uint160, not uint256, for Permit2 unlimited amounts', () => {
    expect(resolvePermit2AllowanceSnapshots(
      targets,
      successState(maxUint256, maxUint160, maxUint48),
    )[0]).toEqual(expect.objectContaining({
      state: 'active',
      isTokenAllowanceUnlimited: true,
      isPermit2AmountUnlimited: true,
      effectiveAmount: maxUint160,
    }))
  })

  it('fails closed for missing, failed, malformed, or out-of-range reads', () => {
    const states = [
      resolvePermit2AllowanceSnapshots(targets, { status: 'success', observedAt: BigInt(1), results: [] })[0]?.state,
      resolvePermit2AllowanceSnapshots(targets, {
        status: 'success',
        observedAt: BigInt(1),
        results: [{ status: 'failure' }, { status: 'success', result: [BigInt(0), BigInt(0), BigInt(0)] }],
      })[0]?.state,
      resolvePermit2AllowanceSnapshots(targets, {
        status: 'success',
        observedAt: BigInt(1),
        results: [{ status: 'success', result: BigInt(0) }, { status: 'success', result: ['0', BigInt(0), BigInt(0)] }],
      })[0]?.state,
      resolvePermit2AllowanceSnapshots(targets, {
        status: 'success',
        observedAt: BigInt(-1),
        results: [{ status: 'success', result: BigInt(0) }, { status: 'success', result: [BigInt(0), BigInt(0), BigInt(0)] }],
      })[0]?.state,
    ]
    expect(states).toEqual(['error', 'error', 'error', 'error'])
  })

  it('formats bounded timestamps without overflowing JavaScript Date', () => {
    expect(formatPermit2Expiration(BigInt(0))).toBe('1970-01-01T00:00:00.000Z')
    expect(formatPermit2Expiration(maxUint48)).toBe('不过期（uint48 最大值）')
  })
})
