import { describe, expect, it } from 'vitest'
import { createTransferReview } from './transferReview'

describe('createTransferReview', () => {
  it('creates an immutable snapshot of the exact wallet payload', () => {
    const review = createTransferReview({
      kind: 'native' as const,
      contextKey: '11155111:0xabc',
      chainId: 11155111,
      chainName: 'Ethereum Sepolia',
      recipient: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE',
      displayAmount: '0.1',
      symbol: 'ETH',
      value: BigInt('100000000000000000'),
      gasCostLimit: BigInt('42000000000000'),
      balance: BigInt('1000000000000000000'),
    })

    expect(Object.isFrozen(review)).toBe(true)
    expect(review.value).toBe(BigInt('100000000000000000'))
    expect(review.gasCostLimit).toBe(BigInt('42000000000000'))
  })
})
