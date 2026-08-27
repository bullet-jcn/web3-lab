import { expect, it, describe } from "vitest"
import { resolveAtomicBatchState, resolveAtomicSupport } from "./eip5792"

describe('resolveAtomicSupport', () => {
  it('returns sequential-fallback undefined status', () => {
    expect(resolveAtomicSupport(undefined)).toBe('sequential-fallback')
  })
  it('returns atomic', () => {
    expect(resolveAtomicSupport('supported')).toBe('atomic')
  })
  it('returns upgrade-then-atomic', () => {
    expect(resolveAtomicSupport('ready')).toBe('upgrade-then-atomic')
  })
  it('returns sequential-fallback for unsupported status', () => {
    expect(resolveAtomicSupport('unsupported')).toBe('sequential-fallback')
  })
})

describe('resolveAtomicBatchState', () => {
  const idleInput = {
    isAwaitingWallet: false,
    bundleId: undefined,
    status: undefined,
    receiptStatuses: [],
    error: null,
  }

  it('distinguishes wallet approval from bundle confirmation', () => {
    expect(resolveAtomicBatchState({ ...idleInput, isAwaitingWallet: true })).toBe('awaiting-wallet')
    expect(resolveAtomicBatchState({ ...idleInput, bundleId: 'bundle-1', status: 'pending' })).toBe('confirming')
  })

  it('returns success for a successful bundle', () => {
    expect(resolveAtomicBatchState({
      ...idleInput,
      bundleId: 'bundle-1',
      status: 'success',
      receiptStatuses: ['success'],
    })).toBe('success')
  })

  it('fails closed when a supposedly successful bundle contains a reverted receipt', () => {
    expect(resolveAtomicBatchState({
      ...idleInput,
      bundleId: 'bundle-1',
      status: 'success',
      receiptStatuses: ['success', 'reverted'],
    })).toBe('failure')
  })

  it('returns failure for a terminal failure or polling error', () => {
    expect(resolveAtomicBatchState({ ...idleInput, bundleId: 'bundle-1', status: 'failure' })).toBe('failure')
    expect(resolveAtomicBatchState({ ...idleInput, error: new Error('timeout') })).toBe('failure')
  })
})
