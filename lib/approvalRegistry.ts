import type { Address } from 'viem'
import { sepolia } from 'viem/chains'
import { SEPOLIA_USDC_ASSET, type SupportedErc20Asset } from './assetRegistry'
import { DEMO_SPENDER_ADDRESS } from './constants'

export interface TrackedErc20ApprovalTarget {
  readonly id: string
  readonly kind: 'erc20'
  readonly chainId: number
  readonly asset: SupportedErc20Asset
  readonly spender: Address
  readonly spenderLabel: string
  readonly source: 'app-registry'
}

export const SEPOLIA_USDC_DEMO_APPROVAL: TrackedErc20ApprovalTarget = Object.freeze({
  id: 'sepolia-usdc-demo-spender',
  kind: 'erc20',
  chainId: sepolia.id,
  asset: SEPOLIA_USDC_ASSET,
  spender: DEMO_SPENDER_ADDRESS,
  spenderLabel: 'Web3 Lab 测试 Spender',
  source: 'app-registry',
})

const APPROVAL_TARGETS_BY_CHAIN: Readonly<Record<number, readonly TrackedErc20ApprovalTarget[]>> = Object.freeze({
  [sepolia.id]: Object.freeze([SEPOLIA_USDC_DEMO_APPROVAL]),
})

export function listTrackedErc20ApprovalTargets(
  chainId: number | undefined,
): readonly TrackedErc20ApprovalTarget[] {
  if (chainId === undefined) return []
  return APPROVAL_TARGETS_BY_CHAIN[chainId] ?? []
}

export function getTrackedErc20ApprovalTarget(
  chainId: number | undefined,
  targetId: string,
): TrackedErc20ApprovalTarget | undefined {
  if (chainId === undefined) return undefined
  return listTrackedErc20ApprovalTargets(chainId).find((target) => target.id === targetId)
}
