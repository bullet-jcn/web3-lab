import { describe, expect, it } from 'vitest'
import type { Address, Hash } from 'viem'
import {
  clearPendingBatch,
  loadPendingBatch,
  PENDING_BATCH_TTL_MS,
  savePendingBatch,
  type PendingBatchInput,
} from './pendingBatchStorage'

const account = '0x0000000000000000000000000000000000000001' as Address
const otherAccount = '0x0000000000000000000000000000000000000002' as Address
const firstHash = `0x${'a'.repeat(64)}` as Hash
const secondHash = `0x${'b'.repeat(64)}` as Hash
const atomicContext = { account, chainId: 11155111, mode: 'atomic' as const }
const sequentialContext = { account, chainId: 11155111, mode: 'sequential' as const }

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('pending batch storage', () => {
  it('round-trips an opaque atomic batch id without treating it as a hash', () => {
    const storage = memoryStorage()
    savePendingBatch(storage, { ...atomicContext, id: 'wallet-bundle:42' }, 1_000)

    expect(loadPendingBatch(storage, atomicContext, { now: 2_000 })).toEqual({
      version: 1,
      ...atomicContext,
      id: 'wallet-bundle:42',
      createdAt: 1_000,
    })
  })

  it.each<PendingBatchInput>([
    { ...sequentialContext, stage: 'first-pending', firstHash },
    { ...sequentialContext, stage: 'first-confirmed', firstHash },
    { ...sequentialContext, stage: 'second-pending', firstHash, secondHash },
  ])('round-trips the sequential $stage stage', (batch) => {
    const storage = memoryStorage()
    savePendingBatch(storage, batch, 1_000)

    expect(loadPendingBatch(storage, sequentialContext, { now: 2_000 })).toEqual({
      version: 1,
      ...batch,
      createdAt: 1_000,
    })
  })

  it('rejects a contradictory sequential stage', () => {
    const storage = memoryStorage()
    savePendingBatch(storage, { ...sequentialContext, stage: 'second-pending', firstHash, secondHash }, 1_000)
    const [key, raw] = [...storage.values.entries()][0]
    storage.values.set(key, JSON.stringify({ ...JSON.parse(raw), stage: 'first-confirmed' }))

    expect(loadPendingBatch(storage, sequentialContext, { now: 2_000 })).toBeNull()
    expect(storage.values.size).toBe(0)
  })

  it('rejects malformed identifiers and tampered wallet context', () => {
    const storage = memoryStorage()
    savePendingBatch(storage, { ...atomicContext, id: 'wallet-bundle:42' }, 1_000)
    const [key, raw] = [...storage.values.entries()][0]
    storage.values.set(key, JSON.stringify({ ...JSON.parse(raw), account: otherAccount }))
    expect(loadPendingBatch(storage, atomicContext, { now: 2_000 })).toBeNull()

    savePendingBatch(storage, { ...sequentialContext, stage: 'first-pending', firstHash }, 1_000)
    const sequentialKey = [...storage.values.keys()][0]
    storage.values.set(sequentialKey, JSON.stringify({
      ...JSON.parse(storage.values.get(sequentialKey)!),
      firstHash: '0x1234',
    }))
    expect(loadPendingBatch(storage, sequentialContext, { now: 2_000 })).toBeNull()
  })

  it('removes malformed and expired records', () => {
    const storage = memoryStorage()
    savePendingBatch(storage, { ...atomicContext, id: 'wallet-bundle:42' }, 1_000)
    const key = [...storage.values.keys()][0]
    storage.values.set(key, '{bad json')
    expect(loadPendingBatch(storage, atomicContext, { now: 2_000 })).toBeNull()

    savePendingBatch(storage, { ...atomicContext, id: 'wallet-bundle:42' }, 1_000)
    expect(loadPendingBatch(storage, atomicContext, {
      now: 1_000 + PENDING_BATCH_TTL_MS + 1,
    })).toBeNull()
  })

  it('isolates and clears records by account, chain, and mode', () => {
    const storage = memoryStorage()
    savePendingBatch(storage, { ...atomicContext, id: 'wallet-bundle:42' }, 1_000)
    savePendingBatch(storage, { ...sequentialContext, stage: 'first-pending', firstHash }, 1_000)
    savePendingBatch(storage, { ...atomicContext, account: otherAccount, id: 'other-bundle' }, 1_000)

    clearPendingBatch(storage, atomicContext)

    expect(loadPendingBatch(storage, atomicContext, { now: 2_000 })).toBeNull()
    expect(loadPendingBatch(storage, sequentialContext, { now: 2_000 })).not.toBeNull()
    expect(loadPendingBatch(storage, { ...atomicContext, account: otherAccount }, { now: 2_000 })).not.toBeNull()
  })
})
