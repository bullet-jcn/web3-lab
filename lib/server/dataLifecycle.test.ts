import { describe, expect, it, vi } from 'vitest'
import {
  createRetentionCutoffs,
  PostgresDataLifecycleRepository,
} from './dataLifecycle'
import type { QueryExecutor, TransactionRunner } from './db/client'

describe('data lifecycle', () => {
  it('derives stable UTC cutoffs from the policy windows', () => {
    expect(createRetentionCutoffs(new Date('2026-09-04T00:00:00.000Z'))).toEqual({
      sessionsBefore: new Date('2026-08-05T00:00:00.000Z'),
      abandonedIntentsBefore: new Date('2026-08-05T00:00:00.000Z'),
      historyBefore: new Date('2025-09-04T00:00:00.000Z'),
    })
  })

  it('previews only aggregate counts without returning user rows', async () => {
    const query = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ sessions: '3', risk_reports: '4', transaction_intents: '5' }],
      }),
    } as QueryExecutor
    const repository = new PostgresDataLifecycleRepository(query, {} as TransactionRunner)
    const cutoffs = createRetentionCutoffs(new Date('2026-09-04T00:00:00.000Z'))

    await expect(repository.previewRetention(cutoffs)).resolves.toEqual({
      sessions: 3,
      riskReports: 4,
      transactionIntents: 5,
    })
    expect(query.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'created'"),
      [cutoffs.sessionsBefore, cutoffs.abandonedIntentsBefore, cutoffs.historyBefore],
    )
  })

  it('serializes retention deletes and keeps them in one transaction', async () => {
    const transaction = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 2, rows: [] })
        .mockResolvedValueOnce({ rowCount: 3, rows: [] })
        .mockResolvedValueOnce({ rowCount: 4, rows: [] }),
    } as QueryExecutor
    const transactions = {
      withTransaction: vi.fn(async (operation) => operation(transaction)),
    } as TransactionRunner
    const repository = new PostgresDataLifecycleRepository({} as QueryExecutor, transactions)

    await expect(repository.applyRetention(createRetentionCutoffs())).resolves.toEqual({
      sessions: 2,
      riskReports: 3,
      transactionIntents: 4,
    })
    expect(transaction.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock($1)',
      [826_421_005],
    )
    expect(transactions.withTransaction).toHaveBeenCalledOnce()
  })

  it('deletes one user under a user-scoped transaction lock', async () => {
    const transaction = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'user-1' }] }),
    } as QueryExecutor
    const transactions = {
      withTransaction: vi.fn(async (operation) => operation(transaction)),
    } as TransactionRunner
    const repository = new PostgresDataLifecycleRepository({} as QueryExecutor, transactions)

    await expect(repository.deleteUserData('user-1')).resolves.toBe(true)
    expect(transaction.query).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM users WHERE id = $1 RETURNING id',
      ['user-1'],
    )
  })
})
