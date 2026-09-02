import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from 'redis'
import { Pool, type PoolClient } from 'pg'
import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import type { QueryExecutor, TransactionRunner } from './db/client'
import {
  PostgresIdentityRepository,
  PostgresRiskReportRepository,
  PostgresSessionRepository,
  PostgresTransactionRepository,
  PostgresWatchlistRepository,
} from './db/repositories'
import { RedisCoordinator, type RedisExecutor } from './redis/coordinator'

class PoolTransactions implements TransactionRunner {
  constructor(private readonly pool: Pool) {}

  async withTransaction<Result>(operation: (query: QueryExecutor) => Promise<Result>) {
    const client: PoolClient = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

const integrationEnabled = process.env.RUN_BACKEND_INTEGRATION === 'true'

describe.runIf(integrationEnabled)('backend service integration', () => {
  it('persists an identity, session, watchlist, transaction receipt, and risk report', async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const transactions = new PoolTransactions(pool)
    const identityRepository = new PostgresIdentityRepository(pool, transactions)
    const sessionRepository = new PostgresSessionRepository(pool)
    const watchlistRepository = new PostgresWatchlistRepository(pool, transactions)
    const transactionRepository = new PostgresTransactionRepository(pool, transactions)
    const riskRepository = new PostgresRiskReportRepository(pool)
    const owner = `0x${randomBytes(20).toString('hex')}` as Address
    const watched = `0x${'1'.repeat(40)}` as Address
    const transactionHash = `0x${'2'.repeat(64)}` as const

    try {
      const identity = await identityRepository.findOrCreate(owner)
      const sameIdentity = await identityRepository.findOrCreate(owner)
      expect(sameIdentity).toEqual(identity)

      const session = await sessionRepository.create({
        userId: identity.userId,
        walletId: identity.walletId,
        chainId: 11_155_111,
        address: identity.address,
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      })
      await expect(sessionRepository.findActiveByTokenHash(session.tokenHash)).resolves.toMatchObject({
        id: session.id,
      })

      await expect(
        watchlistRepository.addWithLimit(
          identity.userId,
          11_155_111,
          watched,
          'CI wallet',
          20,
        ),
      ).resolves.toMatchObject({ status: 'added' })
      await expect(watchlistRepository.list(identity.userId, 11_155_111)).resolves.toHaveLength(1)

      const intent = await transactionRepository.createIntent({
        userId: identity.userId,
        walletId: identity.walletId,
        chainId: 11_155_111,
        kind: 'erc20-approval',
        idempotencyKey: randomUUID(),
        requestFingerprint: 'b'.repeat(64),
        targetAddress: watched,
      })
      await expect(transactionRepository.markBroadcast(intent.id, transactionHash)).resolves.toMatchObject({
        status: 'broadcast',
        transactionHash,
      })
      await transactionRepository.saveReceipt({
        intentId: intent.id,
        chainId: 11_155_111,
        transactionHash,
        status: 'success',
        blockNumber: BigInt(123),
        gasUsed: BigInt(21_000),
        effectiveGasPrice: BigInt(10),
      })
      const receipt = await pool.query(
        'SELECT status FROM transaction_receipts WHERE intent_id = $1',
        [intent.id],
      )
      expect(receipt.rows[0].status).toBe('success')

      const reportId = await riskRepository.create({
        userId: identity.userId,
        walletId: identity.walletId,
        intentId: intent.id,
        chainId: 11_155_111,
        operation: 'erc20-approval',
        targetAddress: watched,
        findingCodes: ['UNRECOGNIZED_SPENDER'],
        highestSeverity: 'medium',
        decision: 'proceeded-to-wallet',
      })
      const report = await pool.query('SELECT finding_codes FROM risk_reports WHERE id = $1', [reportId])
      expect(report.rows[0].finding_codes).toEqual(['UNRECOGNIZED_SPENDER'])
    } finally {
      await pool.end()
    }
  })

  it('executes nonce, idempotency, revocation, and rate-limit operations in Redis', async () => {
    const client = createClient({ url: process.env.REDIS_URL })
    await client.connect()
    const redis: RedisExecutor = {
      set: (key, value, options) => client.set(key, value, options),
      get: (key) => client.get(key),
      getDel: (key) => client.getDel(key),
      eval: (script, options) => client.eval(script, options),
    }
    const coordinator = new RedisCoordinator(redis)
    const unique = randomUUID()

    try {
      await expect(coordinator.issueNonce(unique, 60)).resolves.toBe(true)
      await expect(coordinator.consumeNonce(unique)).resolves.toBe(true)
      await expect(coordinator.consumeNonce(unique)).resolves.toBe(false)
      await expect(coordinator.claimIdempotency(unique, 'request', 'fingerprint', 60)).resolves.toBe(
        'acquired',
      )
      await coordinator.markSessionRevoked(unique, 60)
      await expect(coordinator.isSessionRevoked(unique)).resolves.toBe(true)
      await expect(coordinator.checkRateLimit(unique, 'subject', 1, 60)).resolves.toMatchObject({
        allowed: true,
        remaining: 0,
      })
      await expect(coordinator.checkRateLimit(unique, 'subject', 1, 60)).resolves.toMatchObject({
        allowed: false,
      })
    } finally {
      await client.destroy()
    }
  })
})
