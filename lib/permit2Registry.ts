import type { Address, Hash } from 'viem'
import { sepolia } from 'viem/chains'
import { SEPOLIA_USDC_ASSET, type SupportedErc20Asset } from './assetRegistry'
import { DEMO_SPENDER_ADDRESS } from './constants'

export const CANONICAL_PERMIT2_ADDRESS: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

export interface TrackedPermit2AllowanceTarget {
  readonly id: string
  readonly kind: 'permit2-allowance'
  readonly chainId: number
  readonly permit2Address: Address
  readonly permit2RuntimeCodeHash: Hash
  readonly asset: SupportedErc20Asset
  readonly spender: Address
  readonly spenderLabel: string
  readonly source: 'app-registry'
}

export const SEPOLIA_USDC_DEMO_PERMIT2_ALLOWANCE: TrackedPermit2AllowanceTarget = Object.freeze({
  id: 'sepolia-usdc-demo-spender-permit2',
  kind: 'permit2-allowance',
  chainId: sepolia.id,
  permit2Address: CANONICAL_PERMIT2_ADDRESS,
  permit2RuntimeCodeHash: '0x96d9f5c3f0fb0423426b7f970186235b7347027f4e5c19c40c412b7d97fc3751',
  asset: SEPOLIA_USDC_ASSET,
  spender: DEMO_SPENDER_ADDRESS,
  spenderLabel: 'Web3 Lab 测试 Spender',
  source: 'app-registry',
})

const PERMIT2_TARGETS_BY_CHAIN: Readonly<Record<number, readonly TrackedPermit2AllowanceTarget[]>> = Object.freeze({
  [sepolia.id]: Object.freeze([SEPOLIA_USDC_DEMO_PERMIT2_ALLOWANCE]),
})

export function listTrackedPermit2AllowanceTargets(
  chainId: number | undefined,
): readonly TrackedPermit2AllowanceTarget[] {
  if (chainId === undefined) return []
  return PERMIT2_TARGETS_BY_CHAIN[chainId] ?? []
}

export function getTrackedPermit2AllowanceTarget(
  chainId: number | undefined,
  targetId: string,
): TrackedPermit2AllowanceTarget | undefined {
  if (chainId === undefined) return undefined
  return listTrackedPermit2AllowanceTargets(chainId).find((target) => target.id === targetId)
}
