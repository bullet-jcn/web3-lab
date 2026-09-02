import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import type { QueryExecutor, TransactionRunner } from './client'
import {
  IdempotencyConflictError,
  PostgresIdentityRepository,
  PostgresTransactionRepository,
  PostgresWatchlistRepository,
} from './repositories'

interface QueuedResult {
  rows: Record<string, unknown>[]
  rowCount: number
}

class RecordingQuery implements QueryExecutor {
  readonly calls: Array<{ text: string; values?: unknown[] }> = []
  readonly results: QueuedResult[] = []

  async query<Row>(text: string, values?: unknown[]) {
    this.calls.push({ text, values })
    const result = this.results.shift() ?? { rows: [], rowCount: 0 }
    return result as { rows: Row[]; rowCount: number }
  }
}

class RecordingTransactions implements TransactionRunner {
  calls = 0

  constructor(readonly query: RecordingQuery) {}

  async withTransaction<Result>(operation: (query: QueryExecutor) => Promise<Result>) {
    this.calls += 1
    return operation(this.query)
  }
}

const address = '0x1234567890123456789012345678901234567890' as Address

describe('Postgres repositories', () => {
  it('serializes identity creation by normalized wallet address', async () => {
    const query = new RecordingQuery()
    const transactions = new RecordingTransactions(query)
    query.results.push(
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 1 },
      {
        rows: [
          {
            user_id: 'user-id',
            wallet_id: 'wallet-id',
            address,
            user_status: 'active',
          },
        ],
        rowCount: 1,
      },
    )

    const repository = new PostgresIdentityRepository(query, transactions)
    await expect(repository.findOrCreate(address.toUpperCase() as Address)).resolves.toMatchObject({
      userId: 'user-id',
      walletId: 'wallet-id',
      address,
    })

    expect(transactions.calls).toBe(1)
    expect(query.calls[0].text).toContain('pg_advisory_xact_lock')
    expect(query.calls[0].values).toEqual([address])
  })

  it('returns an existing intent for an exact idempotent replay', async () => {
    const query = new RecordingQuery()
    const transactions = new RecordingTransactions(query)
    query.results.push({
      rows: [
        {
          id: 'intent-id',
          user_id: 'user-id',
          wallet_id: 'wallet-id',
          chain_id: '11155111',
          kind: 'erc20-transfer',
          status: 'created',
          idempotency_key: 'request-1',
          request_fingerprint: 'a'.repeat(64),
          target_address: address,
          transaction_hash: null,
          replaced_by_hash: null,
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      rowCount: 1,
    })
    const repository = new PostgresTransactionRepository(query, transactions)

    await expect(
      repository.createIntent({
        userId: 'user-id',
        walletId: 'wallet-id',
        chainId: 11_155_111,
        kind: 'erc20-transfer',
        idempotencyKey: 'request-1',
        requestFingerprint: 'a'.repeat(64),
        targetAddress: address,
      }),
    ).resolves.toMatchObject({ id: 'intent-id', chainId: 11_155_111 })
    expect(query.calls[0].text).toContain('ON CONFLICT (user_id, idempotency_key)')
  })

  it('rejects reuse of an idempotency key with different intent data', async () => {
    const query = new RecordingQuery()
    const transactions = new RecordingTransactions(query)
    query.results.push({
      rows: [
        {
          id: 'intent-id',
          user_id: 'user-id',
          wallet_id: 'wallet-id',
          chain_id: '11155111',
          kind: 'erc20-transfer',
          status: 'created',
          idempotency_key: 'request-1',
          request_fingerprint: 'b'.repeat(64),
          target_address: address,
          transaction_hash: null,
          replaced_by_hash: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      rowCount: 1,
    })
    const repository = new PostgresTransactionRepository(query, transactions)

    await expect(
      repository.createIntent({
        userId: 'user-id',
        walletId: 'wallet-id',
        chainId: 11_155_111,
        kind: 'erc20-transfer',
        idempotencyKey: 'request-1',
        requestFingerprint: 'a'.repeat(64),
        targetAddress: address,
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError)
  })

  it('persists a receipt and terminal intent status in one transaction', async () => {
    const query = new RecordingQuery()
    const transactions = new RecordingTransactions(query)
    const repository = new PostgresTransactionRepository(query, transactions)
    const transactionHash = `0x${'1'.repeat(64)}` as const

    await repository.saveReceipt({
      intentId: 'intent-id',
      chainId: 11_155_111,
      transactionHash,
      status: 'success',
      blockNumber: BigInt(123),
      gasUsed: BigInt(21_000),
      effectiveGasPrice: BigInt(10),
    })

    expect(transactions.calls).toBe(1)
    expect(query.calls).toHaveLength(2)
    expect(query.calls[0].values).toContain('21000')
    expect(query.calls[1].values).toEqual(['intent-id', 'confirmed'])
  })

  it('serializes watchlist capacity checks before inserting', async () => {
    const query = new RecordingQuery()
    const transactions = new RecordingTransactions(query)
    query.results.push(
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [{ count: '19' }], rowCount: 1 },
      {
        rows: [
          {
            id: 'entry-id',
            user_id: 'user-id',
            chain_id: '11155111',
            address,
            label: null,
            created_at: new Date('2026-01-01T00:00:00Z'),
          },
        ],
        rowCount: 1,
      },
    )
    const repository = new PostgresWatchlistRepository(query, transactions)

    await expect(
      repository.addWithLimit('user-id', 11_155_111, address, null, 20),
    ).resolves.toMatchObject({ status: 'added', entry: { address } })
    expect(query.calls[0].text).toContain('pg_advisory_xact_lock')
    expect(query.calls[2].text).toContain('count(*)')
  })

  it('does not insert after the watchlist reaches capacity', async () => {
    const query = new RecordingQuery()
    const transactions = new RecordingTransactions(query)
    query.results.push(
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [{ count: '20' }], rowCount: 1 },
    )
    const repository = new PostgresWatchlistRepository(query, transactions)

    await expect(
      repository.addWithLimit('user-id', 11_155_111, address, null, 20),
    ).resolves.toEqual({ status: 'full' })
    expect(query.calls).toHaveLength(3)
  })
})
