import { describe, expect, it } from 'vitest'
import type { Address, Hash } from 'viem'
import { PENDING_TRANSACTION_TTL_MS } from './pendingTransactionStorage'
import {
  clearPendingApprovalRevoke,
  loadPendingApprovalRevoke,
  savePendingApprovalRevoke,
} from './pendingApprovalRevokeStorage'

const account = '0x0000000000000000000000000000000000000001' as Address
const hash = `0x${'a'.repeat(64)}` as Hash
const context = { account, chainId: 11155111 }

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('pending approval revoke storage', () => {
  it('round-trips one public target id and hash per account and chain', () => {
    const storage = memoryStorage()
    savePendingApprovalRevoke(storage, {
      ...context,
      targetId: 'sepolia-usdc-demo-spender',
      hash,
    }, 1_000)

    expect(loadPendingApprovalRevoke(storage, context, { now: 2_000 })).toEqual({
      version: 1,
      ...context,
      targetId: 'sepolia-usdc-demo-spender',
      hash,
      createdAt: 1_000,
    })
  })

  it('rejects tampered wallet context and malformed target ids', () => {
    const storage = memoryStorage()
    savePendingApprovalRevoke(storage, {
      ...context,
      targetId: 'sepolia-usdc-demo-spender',
      hash,
    }, 1_000)
    const [key, raw] = [...storage.values.entries()][0]
    storage.values.set(key, JSON.stringify({
      ...JSON.parse(raw),
      targetId: '../attacker-target',
    }))

    expect(loadPendingApprovalRevoke(storage, context, { now: 2_000 })).toBeNull()
    expect(storage.values.size).toBe(0)
  })

  it('removes malformed, future, and expired records', () => {
    const storage = memoryStorage()
    savePendingApprovalRevoke(storage, {
      ...context,
      targetId: 'sepolia-usdc-demo-spender',
      hash,
    }, 1_000)
    const key = [...storage.values.keys()][0]
    storage.values.set(key, '{bad json')
    expect(loadPendingApprovalRevoke(storage, context, { now: 2_000 })).toBeNull()

    savePendingApprovalRevoke(storage, {
      ...context,
      targetId: 'sepolia-usdc-demo-spender',
      hash,
    }, 3_000)
    expect(loadPendingApprovalRevoke(storage, context, { now: 2_000 })).toBeNull()

    savePendingApprovalRevoke(storage, {
      ...context,
      targetId: 'sepolia-usdc-demo-spender',
      hash,
    }, 1_000)
    expect(loadPendingApprovalRevoke(storage, context, {
      now: 1_000 + PENDING_TRANSACTION_TTL_MS + 1,
    })).toBeNull()
  })

  it('clears only the selected account and chain record', () => {
    const storage = memoryStorage()
    savePendingApprovalRevoke(storage, {
      ...context,
      targetId: 'sepolia-usdc-demo-spender',
      hash,
    }, 1_000)

    clearPendingApprovalRevoke(storage, context)
    expect(loadPendingApprovalRevoke(storage, context, { now: 2_000 })).toBeNull()
  })
})
