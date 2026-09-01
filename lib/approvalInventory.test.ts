import { describe, expect, it } from 'vitest'
import { maxUint256 } from 'viem'
import { sepolia } from 'viem/chains'
import { listTrackedErc20ApprovalTargets } from './approvalRegistry'
import { resolveErc20ApprovalSnapshots } from './approvalInventory'

const targets = listTrackedErc20ApprovalTargets(sepolia.id)

describe('approval inventory snapshots', () => {
  it('keeps loading and top-level query errors distinct', () => {
    expect(resolveErc20ApprovalSnapshots(targets, { status: 'loading' })[0]?.state).toBe('loading')
    expect(resolveErc20ApprovalSnapshots(targets, { status: 'error' })[0]?.state).toBe('error')
  })

  it('classifies a zero allowance as no approval', () => {
    expect(resolveErc20ApprovalSnapshots(targets, {
      status: 'success',
      results: [{ status: 'success', result: BigInt(0) }],
    })[0]).toEqual(expect.objectContaining({
      state: 'none',
      allowance: BigInt(0),
      formattedAllowance: '0',
      isUnlimited: false,
    }))
  })

  it('formats a positive allowance using registry decimals', () => {
    expect(resolveErc20ApprovalSnapshots(targets, {
      status: 'success',
      results: [{ status: 'success', result: BigInt(1_500_000) }],
    })[0]).toEqual(expect.objectContaining({
      state: 'active',
      allowance: BigInt(1_500_000),
      formattedAllowance: '1.5',
      isUnlimited: false,
    }))
  })

  it('detects exactly the uint256 maximum as unlimited', () => {
    expect(resolveErc20ApprovalSnapshots(targets, {
      status: 'success',
      results: [{ status: 'success', result: maxUint256 }],
    })[0]).toEqual(expect.objectContaining({
      state: 'active',
      allowance: maxUint256,
      isUnlimited: true,
    }))
  })

  it('fails closed for failed, missing, or malformed contract results', () => {
    const states = [
      resolveErc20ApprovalSnapshots(targets, {
        status: 'success',
        results: [{ status: 'failure', error: new Error('RPC failed') }],
      })[0]?.state,
      resolveErc20ApprovalSnapshots(targets, {
        status: 'success',
        results: [],
      })[0]?.state,
      resolveErc20ApprovalSnapshots(targets, {
        status: 'success',
        results: [{ status: 'success', result: '0' }],
      })[0]?.state,
    ]

    expect(states).toEqual(['error', 'error', 'error'])
  })
})
