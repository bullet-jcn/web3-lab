import { describe, expect, it } from 'vitest'
import type { Address, Hash } from 'viem'
import {
  clearPendingTransaction,
  loadPendingTransaction,
  PENDING_TRANSACTION_TTL_MS,
  savePendingTransaction,
} from './pendingTransactionStorage'

const account = '0x0000000000000000000000000000000000000001' as Address
const hash = `0x${'a'.repeat(64)}` as Hash
const context = { account, chainId: 11155111, kind: 'erc20-transfer' as const }

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('pending transaction storage', () => {
  it('round-trips a versioned record in the matching wallet context', () => {
    const storage = memoryStorage()
    savePendingTransaction(storage, { ...context, hash }, 1_000)

    expect(loadPendingTransaction(storage, context, { now: 2_000 })).toEqual({
      version: 1,
      ...context,
      hash,
      createdAt: 1_000,
    })
  })

  it('rejects tampered context instead of restoring it under another wallet', () => {
    const storage = memoryStorage()
    savePendingTransaction(storage, { ...context, hash }, 1_000)
    const [key, raw] = [...storage.values.entries()][0]
    storage.values.set(key, JSON.stringify({ ...JSON.parse(raw), account: '0x0000000000000000000000000000000000000002' }))

    expect(loadPendingTransaction(storage, context, { now: 2_000 })).toBeNull()
    expect(storage.values.size).toBe(0)
  })

  it('removes malformed and expired records', () => {
    const storage = memoryStorage()
    savePendingTransaction(storage, { ...context, hash }, 1_000)
    const key = [...storage.values.keys()][0]
    storage.values.set(key, '{bad json')
    expect(loadPendingTransaction(storage, context, { now: 2_000 })).toBeNull()

    savePendingTransaction(storage, { ...context, hash }, 1_000)
    expect(loadPendingTransaction(storage, context, {
      now: 1_000 + PENDING_TRANSACTION_TTL_MS + 1,
    })).toBeNull()
  })

  it('clears only the selected account, chain, and transaction kind', () => {
    const storage = memoryStorage()
    savePendingTransaction(storage, { ...context, hash }, 1_000)
    savePendingTransaction(storage, { ...context, kind: 'approval', hash }, 1_000)

    clearPendingTransaction(storage, context)

    expect(loadPendingTransaction(storage, context, { now: 2_000 })).toBeNull()
    expect(loadPendingTransaction(storage, { ...context, kind: 'approval' }, { now: 2_000 })).not.toBeNull()
  })
})
