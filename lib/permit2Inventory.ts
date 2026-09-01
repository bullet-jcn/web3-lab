import { formatUnits, maxUint48, maxUint160, maxUint256 } from 'viem'
import type { ApprovalContractReadResult } from './approvalInventory'
import type { TrackedPermit2AllowanceTarget } from './permit2Registry'

export type Permit2InventoryReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
      readonly status: 'success'
      readonly results: readonly ApprovalContractReadResult[]
      readonly observedAt: bigint
    }

interface Permit2AllowanceEvidence {
  readonly tokenAllowanceToPermit2: bigint
  readonly formattedTokenAllowanceToPermit2: string
  readonly amount: bigint
  readonly formattedAmount: string
  readonly expiration: bigint
  readonly nonce: bigint
  readonly isTokenAllowanceUnlimited: boolean
  readonly isPermit2AmountUnlimited: boolean
}

export type Permit2AllowanceSnapshot =
  | {
      readonly target: TrackedPermit2AllowanceTarget
      readonly state: 'loading' | 'error'
    }
  | ({
      readonly target: TrackedPermit2AllowanceTarget
      readonly state: 'none' | 'expired' | 'dormant'
    } & Permit2AllowanceEvidence)
  | ({
      readonly target: TrackedPermit2AllowanceTarget
      readonly state: 'active'
      readonly effectiveAmount: bigint
      readonly formattedEffectiveAmount: string
    } & Permit2AllowanceEvidence)

function parsePermit2AllowanceResult(result: unknown): readonly [bigint, bigint, bigint] | null {
  if (!Array.isArray(result) || result.length !== 3) return null
  const [amount, expiration, nonce] = result
  if (typeof amount !== 'bigint' || amount < BigInt(0) || amount > maxUint160) return null
  if (typeof expiration !== 'bigint' || expiration < BigInt(0) || expiration > maxUint48) return null
  if (typeof nonce !== 'bigint' || nonce < BigInt(0) || nonce > maxUint48) return null
  return [amount, expiration, nonce]
}

export function resolvePermit2AllowanceSnapshots(
  targets: readonly TrackedPermit2AllowanceTarget[],
  readState: Permit2InventoryReadState,
): readonly Permit2AllowanceSnapshot[] {
  if (readState.status !== 'success') {
    return targets.map((target) => ({ target, state: readState.status }))
  }
  if (readState.observedAt < BigInt(0)) {
    return targets.map((target) => ({ target, state: 'error' }))
  }

  return targets.map((target, targetIndex) => {
    const tokenRead = readState.results[targetIndex * 2]
    const permit2Read = readState.results[targetIndex * 2 + 1]
    if (tokenRead?.status !== 'success'
      || typeof tokenRead.result !== 'bigint'
      || tokenRead.result < BigInt(0)
      || tokenRead.result > maxUint256
      || permit2Read?.status !== 'success') {
      return { target, state: 'error' }
    }
    const permit2Allowance = parsePermit2AllowanceResult(permit2Read.result)
    if (!permit2Allowance) return { target, state: 'error' }

    const [amount, expiration, nonce] = permit2Allowance
    const evidence: Permit2AllowanceEvidence = {
      tokenAllowanceToPermit2: tokenRead.result,
      formattedTokenAllowanceToPermit2: formatUnits(tokenRead.result, target.asset.decimals),
      amount,
      formattedAmount: formatUnits(amount, target.asset.decimals),
      expiration,
      nonce,
      isTokenAllowanceUnlimited: tokenRead.result === maxUint256,
      isPermit2AmountUnlimited: amount === maxUint160,
    }

    if (amount === BigInt(0)) return { target, state: 'none', ...evidence }
    if (readState.observedAt > expiration) return { target, state: 'expired', ...evidence }
    if (tokenRead.result === BigInt(0)) return { target, state: 'dormant', ...evidence }

    const effectiveAmount = tokenRead.result < amount ? tokenRead.result : amount
    return {
      target,
      state: 'active',
      ...evidence,
      effectiveAmount,
      formattedEffectiveAmount: formatUnits(effectiveAmount, target.asset.decimals),
    }
  })
}

export function formatPermit2Expiration(expiration: bigint): string {
  if (expiration === maxUint48) return '不过期（uint48 最大值）'
  const milliseconds = expiration * BigInt(1_000)
  if (milliseconds > BigInt(8_640_000_000_000_000)) {
    return `Unix ${expiration.toString()} 秒`
  }
  return new Date(Number(milliseconds)).toISOString()
}
