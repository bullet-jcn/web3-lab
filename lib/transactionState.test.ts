import { describe, expect, it } from 'vitest'
import { resolveTransactionState } from './transactionState'

const idleInput = {
  isAwaitingWallet: false,
  isConfirming: false,
  isSuccess: false,
  error: null,
}

describe('resolveTransactionState', () => {
  it('returns idle before a transaction starts', () => {
    expect(resolveTransactionState(idleInput)).toBe('idle')
  })

  it('distinguishes wallet confirmation from chain confirmation', () => {
    expect(resolveTransactionState({ ...idleInput, isAwaitingWallet: true })).toBe('awaiting-wallet')
    expect(resolveTransactionState({ ...idleInput, isConfirming: true })).toBe('confirming')
  })

  it('returns success after the receipt succeeds', () => {
    expect(resolveTransactionState({ ...idleInput, isSuccess: true })).toBe('success')
  })

  it('gives an error priority over stale pending flags', () => {
    expect(resolveTransactionState({
      ...idleInput,
      isAwaitingWallet: true,
      isConfirming: true,
      error: new Error('reverted'),
    })).toBe('error')
  })
})
