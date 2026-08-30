import { describe, expect, it } from 'vitest'
import { resolveTokenBalanceState } from './tokenBalance'

describe('resolveTokenBalanceState', () => {
  it('fails closed until both parsed amount and balance are known', () => {
    expect(resolveTokenBalanceState(undefined, BigInt(10))).toBe('unavailable')
    expect(resolveTokenBalanceState(BigInt(1), undefined)).toBe('unavailable')
  })

  it('accepts an amount equal to or below the balance', () => {
    expect(resolveTokenBalanceState(BigInt(9), BigInt(10))).toBe('sufficient')
    expect(resolveTokenBalanceState(BigInt(10), BigInt(10))).toBe('sufficient')
  })

  it('rejects an amount above the balance', () => {
    expect(resolveTokenBalanceState(BigInt(11), BigInt(10))).toBe('insufficient')
  })
})
