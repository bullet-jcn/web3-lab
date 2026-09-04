import type { QueryExecutor, TransactionRunner } from './db/client'

export const SESSION_RETENTION_DAYS = 30
export const ABANDONED_INTENT_RETENTION_DAYS = 30
export const HISTORY_RETENTION_DAYS = 365

export interface RetentionCutoffs {
  sessionsBefore: Date
  abandonedIntentsBefore: Date
  historyBefore: Date
}

export interface RetentionCounts {
  sessions: number
  riskReports: number
  transactionIntents: number
}

interface RetentionCountRow {
  sessions: string
  risk_reports: string
  transaction_intents: string
}

const DAY_MS = 24 * 60 * 60 * 1_000
const RETENTION_LOCK_ID = 826_421_005

function subtractDays(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

function safeCount(value: string): number {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Database returned an invalid retention count')
  }
  return count
}

function mapCounts(row: RetentionCountRow): RetentionCounts {
  return {
    sessions: safeCount(row.sessions),
    riskReports: safeCount(row.risk_reports),
    transactionIntents: safeCount(row.transaction_intents),
  }
}

export function createRetentionCutoffs(now = new Date()): RetentionCutoffs {
  return {
    sessionsBefore: subtractDays(now, SESSION_RETENTION_DAYS),
    abandonedIntentsBefore: subtractDays(now, ABANDONED_INTENT_RETENTION_DAYS),
    historyBefore: subtractDays(now, HISTORY_RETENTION_DAYS),
  }
}

export class PostgresDataLifecycleRepository {
  constructor(
    private readonly query: QueryExecutor,
    private readonly transactions: TransactionRunner,
  ) {}

  async deleteUserData(userId: string): Promise<boolean> {
    return this.transactions.withTransaction(async (transaction) => {
      await transaction.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `delete-user:${userId}`,
      ])
      const result = await transaction.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [userId],
      )
      return result.rowCount === 1
    })
  }

  async previewRetention(cutoffs: RetentionCutoffs): Promise<RetentionCounts> {
    const result = await this.query.query<RetentionCountRow>(
      `SELECT
         (SELECT count(*)::text FROM sessions
          WHERE expires_at < $1 OR (revoked_at IS NOT NULL AND revoked_at < $1)) AS sessions,
         (SELECT count(*)::text FROM risk_reports
          WHERE created_at < $3) AS risk_reports,
         (SELECT count(*)::text FROM transaction_intents
          WHERE (status = 'created' AND updated_at < $2)
             OR (status <> 'created' AND updated_at < $3)) AS transaction_intents`,
      [cutoffs.sessionsBefore, cutoffs.abandonedIntentsBefore, cutoffs.historyBefore],
    )
    return mapCounts(result.rows[0])
  }

  async applyRetention(cutoffs: RetentionCutoffs): Promise<RetentionCounts> {
    return this.transactions.withTransaction(async (transaction) => {
      await transaction.query('SELECT pg_advisory_xact_lock($1)', [RETENTION_LOCK_ID])

      const sessions = await transaction.query(
        `DELETE FROM sessions
         WHERE expires_at < $1 OR (revoked_at IS NOT NULL AND revoked_at < $1)`,
        [cutoffs.sessionsBefore],
      )
      const riskReports = await transaction.query(
        'DELETE FROM risk_reports WHERE created_at < $1',
        [cutoffs.historyBefore],
      )
      const transactionIntents = await transaction.query(
        `DELETE FROM transaction_intents
         WHERE (status = 'created' AND updated_at < $1)
            OR (status <> 'created' AND updated_at < $2)`,
        [cutoffs.abandonedIntentsBefore, cutoffs.historyBefore],
      )

      return {
        sessions: sessions.rowCount ?? 0,
        riskReports: riskReports.rowCount ?? 0,
        transactionIntents: transactionIntents.rowCount ?? 0,
      }
    })
  }
}
