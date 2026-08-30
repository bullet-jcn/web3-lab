import type { Address } from 'viem'

interface ReviewBase {
  readonly contextKey: string
  readonly chainId: number
  readonly chainName: string
  readonly recipient: Address
  readonly displayAmount: string
  readonly gasCostLimit: bigint
}

export interface NativeTransferReview extends ReviewBase {
  readonly kind: 'native'
  readonly symbol: string
  readonly value: bigint
  readonly balance: bigint
}

export interface Erc20TransferReview extends ReviewBase {
  readonly kind: 'erc20'
  readonly tokenAddress: Address
  readonly symbol: string
  readonly decimals: number
  readonly amount: bigint
  readonly balance: bigint
  readonly nativeBalance: bigint
}

export type TransferReview = NativeTransferReview | Erc20TransferReview

export function createTransferReview<T extends TransferReview>(review: T): Readonly<T> {
  return Object.freeze({ ...review }) as Readonly<T>
}
