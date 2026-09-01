import type { Address } from 'viem'
import { sepolia } from 'viem/chains'

export interface SupportedErc20Asset {
  readonly id: string
  readonly kind: 'erc20'
  readonly chainId: number
  readonly name: string
  readonly symbol: string
  readonly decimals: number
  readonly address: Address
  readonly highApprovalThreshold: bigint
  readonly eip2612Domain?: {
    readonly name: string
    readonly version: string
  }
}

export const SEPOLIA_USDC_ASSET: SupportedErc20Asset = Object.freeze({
  id: 'usdc',
  kind: 'erc20',
  chainId: sepolia.id,
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  highApprovalThreshold: BigInt(1_000_000_000),
  eip2612Domain: Object.freeze({ name: 'USDC', version: '2' }),
})

const ERC20_ASSETS_BY_CHAIN: Readonly<Record<number, Readonly<Record<string, SupportedErc20Asset>>>> = Object.freeze({
  [sepolia.id]: Object.freeze({
    [SEPOLIA_USDC_ASSET.id]: SEPOLIA_USDC_ASSET,
  }),
})

export function listSupportedErc20Assets(chainId: number | undefined): readonly SupportedErc20Asset[] {
  if (chainId === undefined) return []
  return Object.values(ERC20_ASSETS_BY_CHAIN[chainId] ?? {})
}

export function getSupportedErc20Asset(chainId: number | undefined, assetId: string): SupportedErc20Asset | undefined {
  if (chainId === undefined) return undefined
  const chainAssets = ERC20_ASSETS_BY_CHAIN[chainId]
  if (!chainAssets || !Object.prototype.hasOwnProperty.call(chainAssets, assetId)) return undefined
  return chainAssets[assetId]
}
