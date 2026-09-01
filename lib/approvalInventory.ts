import { formatUnits, maxUint256 } from 'viem'
import type { TrackedErc20ApprovalTarget } from './approvalRegistry'

export type ApprovalContractReadResult =
  | { readonly status: 'success'; readonly result: unknown }
  | { readonly status: 'failure'; readonly error?: unknown }

export type ApprovalInventoryReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
      readonly status: 'success'
      readonly results: readonly ApprovalContractReadResult[]
    }

export type Erc20ApprovalSnapshot =
  | {
      readonly target: TrackedErc20ApprovalTarget
      readonly state: 'loading' | 'error'
    }
  | {
      readonly target: TrackedErc20ApprovalTarget
      readonly state: 'none'
      readonly allowance: bigint
      readonly formattedAllowance: '0'
      readonly isUnlimited: false
    }
  | {
      readonly target: TrackedErc20ApprovalTarget
      readonly state: 'active'
      readonly allowance: bigint
      readonly formattedAllowance: string
      readonly isUnlimited: boolean
    }

export function resolveErc20ApprovalSnapshots(
  targets: readonly TrackedErc20ApprovalTarget[],
  readState: ApprovalInventoryReadState,
): readonly Erc20ApprovalSnapshot[] {
  if (readState.status !== 'success') {
    return targets.map((target) => ({ target, state: readState.status }))
  }

  return targets.map((target, index) => {
    const readResult = readState.results[index]
    if (readResult?.status !== 'success' || typeof readResult.result !== 'bigint' || readResult.result < BigInt(0)) {
      return { target, state: 'error' }
    }

    if (readResult.result === BigInt(0)) {
      return {
        target,
        state: 'none',
        allowance: BigInt(0),
        formattedAllowance: '0',
        isUnlimited: false,
      }
    }

    return {
      target,
      state: 'active',
      allowance: readResult.result,
      formattedAllowance: formatUnits(readResult.result, target.asset.decimals),
      isUnlimited: readResult.result === maxUint256,
    }
  })
}
