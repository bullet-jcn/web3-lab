import { randomUUID } from 'node:crypto'
import type { Address, Hash } from 'viem'
import type { QueryExecutor, TransactionRunner } from './client'

export type UserStatus = 'active' | 'disabled'
export type TransactionIntentKind =
  | 'native-transfer'
  | 'erc20-transfer'
  | 'erc20-approval'
  | 'erc20-revoke'
  | 'permit2-lockdown'
  | 'batch'
export type TransactionIntentStatus =
  | 'created'
  | 'broadcast'
  | 'confirmed'
  | 'reverted'
  | 'cancelled'
  | 'replaced'
export type RiskDecision = 'blocked' | 'cancelled' | 'proceeded-to-wallet'
export type RiskSeverity = 'low' | 'medium' | 'high'

export interface WalletIdentity {
  userId: string
  walletId: string
  address: Address
  userStatus: UserStatus
}

export interface SessionRecord {
  id: string
  userId: string
  walletId: string
  chainId: number
  address: Address
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
}

export interface WatchlistEntry {
  id: string
  userId: string
  chainId: number
  address: Address
  label: string | null
  createdAt: Date
}

export interface TransactionIntent {
  id: string
  userId: string
  walletId: string
  chainId: number
  kind: TransactionIntentKind
  status: TransactionIntentStatus
  idempotencyKey: string
  requestFingerprint: string
  targetAddress: Address | null
  transactionHash: Hash | null
  replacedByHash: Hash | null
  createdAt: Date
  updatedAt: Date
}

export interface ReceiptInput {
  intentId: string
  chainId: number
  transactionHash: Hash
  status: 'success' | 'reverted'
  blockNumber: bigint
  gasUsed: bigint
  effectiveGasPrice: bigint | null
}

export interface RiskReportInput {
  userId: string
  walletId: string
  intentId: string | null
  chainId: number
  operation: string
  targetAddress: Address | null
  findingCodes: string[]
  highestSeverity: RiskSeverity
  decision: RiskDecision
}

interface IdentityRow {
  user_id: string
  wallet_id: string
  address: Address
  user_status: UserStatus
}

interface SessionRow {
  id: string
  user_id: string
  wallet_id: string
  chain_id: string
  address: Address
  token_hash: string
  expires_at: Date
  revoked_at: Date | null
}

interface WatchlistRow {
  id: string
  user_id: string
  chain_id: string
  address: Address
  label: string | null
  created_at: Date
}

interface CountRow {
  count: string
}

interface IntentRow {
  id: string
  user_id: string
  wallet_id: string
  chain_id: string
  kind: TransactionIntentKind
  status: TransactionIntentStatus
  idempotency_key: string
  request_fingerprint: string
  target_address: Address | null
  transaction_hash: Hash | null
  replaced_by_hash: Hash | null
  created_at: Date
  updated_at: Date
}

function normalizeAddress(address: Address): Address {
  return address.toLowerCase() as Address
}

function safeChainId(value: string): number {
  const chainId = Number(value)
  if (!Number.isSafeInteger(chainId) || chainId < 1) {
    throw new Error('Database returned an unsupported chain ID')
  }
  return chainId
}

function mapIdentity(row: IdentityRow): WalletIdentity {
  return {
    userId: row.user_id,
    walletId: row.wallet_id,
    address: row.address,
    userStatus: row.user_status,
  }
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    chainId: safeChainId(row.chain_id),
    address: row.address,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }
}

function mapWatchlist(row: WatchlistRow): WatchlistEntry {
  return {
    id: row.id,
    userId: row.user_id,
    chainId: safeChainId(row.chain_id),
    address: row.address,
    label: row.label,
    createdAt: row.created_at,
  }
}

function mapIntent(row: IntentRow): TransactionIntent {
  return {
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    chainId: safeChainId(row.chain_id),
    kind: row.kind,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    requestFingerprint: row.request_fingerprint,
    targetAddress: row.target_address,
    transactionHash: row.transaction_hash,
    replacedByHash: row.replaced_by_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used for a different transaction intent')
    this.name = 'IdempotencyConflictError'
  }
}

export class PostgresIdentityRepository {
  constructor(
    private readonly query: QueryExecutor,
    private readonly transactions: TransactionRunner,
  ) {}

  async findByAddress(address: Address): Promise<WalletIdentity | null> {
    const result = await this.query.query<IdentityRow>(
      `SELECT users.id AS user_id, wallets.id AS wallet_id, wallets.address, users.status AS user_status
       FROM wallets
       JOIN users ON users.id = wallets.user_id
       WHERE wallets.address = $1`,
      [normalizeAddress(address)],
    )
    return result.rows[0] ? mapIdentity(result.rows[0]) : null
  }

  async findOrCreate(address: Address): Promise<WalletIdentity> {
    const normalizedAddress = normalizeAddress(address)
    return this.transactions.withTransaction(async (transaction) => {
      await transaction.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        normalizedAddress,
      ])
      const existing = await transaction.query<IdentityRow>(
        `SELECT users.id AS user_id, wallets.id AS wallet_id, wallets.address, users.status AS user_status
         FROM wallets
         JOIN users ON users.id = wallets.user_id
         WHERE wallets.address = $1`,
        [normalizedAddress],
      )
      if (existing.rows[0]) {
        await transaction.query(
          'UPDATE wallets SET last_authenticated_at = now() WHERE id = $1',
          [existing.rows[0].wallet_id],
        )
        return mapIdentity(existing.rows[0])
      }

      const userId = randomUUID()
      const walletId = randomUUID()
      await transaction.query('INSERT INTO users (id) VALUES ($1)', [userId])
      const inserted = await transaction.query<IdentityRow>(
        `INSERT INTO wallets (id, user_id, address)
         VALUES ($1, $2, $3)
         RETURNING $2::uuid AS user_id, id AS wallet_id, address, 'active'::user_status AS user_status`,
        [walletId, userId, normalizedAddress],
      )
      return mapIdentity(inserted.rows[0])
    })
  }
}

export interface SessionRepository {
  create(input: Omit<SessionRecord, 'id' | 'revokedAt'>): Promise<SessionRecord>
  findActiveByTokenHash(tokenHash: string, now?: Date): Promise<SessionRecord | null>
  revoke(id: string, revokedAt?: Date): Promise<boolean>
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly query: QueryExecutor) {}

  async create(input: Omit<SessionRecord, 'id' | 'revokedAt'>): Promise<SessionRecord> {
    const result = await this.query.query<SessionRow>(
      `WITH inserted AS (
         INSERT INTO sessions (id, user_id, wallet_id, chain_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, wallet_id, chain_id, token_hash, expires_at, revoked_at
       )
       SELECT inserted.*, wallets.address
       FROM inserted
       JOIN wallets ON wallets.id = inserted.wallet_id`,
      [
        randomUUID(),
        input.userId,
        input.walletId,
        input.chainId,
        input.tokenHash,
        input.expiresAt,
      ],
    )
    return mapSession(result.rows[0])
  }

  async findActiveByTokenHash(tokenHash: string, now = new Date()): Promise<SessionRecord | null> {
    const result = await this.query.query<SessionRow>(
      `SELECT sessions.id, sessions.user_id, sessions.wallet_id, sessions.chain_id,
              wallets.address, sessions.token_hash, sessions.expires_at, sessions.revoked_at
       FROM sessions
       JOIN wallets ON wallets.id = sessions.wallet_id
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1
         AND sessions.revoked_at IS NULL
         AND sessions.expires_at > $2
         AND users.status = 'active'`,
      [tokenHash, now],
    )
    return result.rows[0] ? mapSession(result.rows[0]) : null
  }

  async revoke(id: string, revokedAt = new Date()): Promise<boolean> {
    const result = await this.query.query(
      `UPDATE sessions
       SET revoked_at = $2
       WHERE id = $1 AND revoked_at IS NULL`,
      [id, revokedAt],
    )
    return result.rowCount === 1
  }
}

export class PostgresWatchlistRepository {
  constructor(
    private readonly query: QueryExecutor,
    private readonly transactions?: TransactionRunner,
  ) {}

  async list(userId: string, chainId: number): Promise<WatchlistEntry[]> {
    const result = await this.query.query<WatchlistRow>(
      `SELECT id, user_id, chain_id, address, label, created_at
       FROM watchlist_entries
       WHERE user_id = $1 AND chain_id = $2
       ORDER BY created_at ASC`,
      [userId, chainId],
    )
    return result.rows.map(mapWatchlist)
  }

  async add(
    userId: string,
    chainId: number,
    address: Address,
    label: string | null,
  ): Promise<WatchlistEntry> {
    const result = await this.query.query<WatchlistRow>(
      `INSERT INTO watchlist_entries (id, user_id, chain_id, address, label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, chain_id, address, label, created_at`,
      [randomUUID(), userId, chainId, normalizeAddress(address), label],
    )
    return mapWatchlist(result.rows[0])
  }

  async addWithLimit(
    userId: string,
    chainId: number,
    address: Address,
    label: string | null,
    maximumEntries: number,
  ): Promise<{ status: 'added'; entry: WatchlistEntry } | { status: 'duplicate' | 'full' }> {
    if (!this.transactions) throw new Error('A transaction runner is required for bounded inserts')
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 1) {
      throw new Error('Watchlist limit must be a positive integer')
    }

    const normalizedAddress = normalizeAddress(address)
    return this.transactions.withTransaction(async (transaction) => {
      await transaction.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `${userId}:${chainId}`,
      ])
      const duplicate = await transaction.query(
        `SELECT 1 FROM watchlist_entries
         WHERE user_id = $1 AND chain_id = $2 AND address = $3`,
        [userId, chainId, normalizedAddress],
      )
      if (duplicate.rowCount) return { status: 'duplicate' as const }

      const count = await transaction.query<CountRow>(
        'SELECT count(*)::text AS count FROM watchlist_entries WHERE user_id = $1 AND chain_id = $2',
        [userId, chainId],
      )
      if (Number(count.rows[0].count) >= maximumEntries) return { status: 'full' as const }

      const inserted = await transaction.query<WatchlistRow>(
        `INSERT INTO watchlist_entries (id, user_id, chain_id, address, label)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, chain_id, address, label, created_at`,
        [randomUUID(), userId, chainId, normalizedAddress, label],
      )
      return { status: 'added' as const, entry: mapWatchlist(inserted.rows[0]) }
    })
  }

  async remove(userId: string, chainId: number, address: Address): Promise<boolean> {
    const result = await this.query.query(
      'DELETE FROM watchlist_entries WHERE user_id = $1 AND chain_id = $2 AND address = $3',
      [userId, chainId, normalizeAddress(address)],
    )
    return result.rowCount === 1
  }
}

export class PostgresTransactionRepository {
  constructor(
    private readonly query: QueryExecutor,
    private readonly transactions: TransactionRunner,
  ) {}

  async createIntent(
    input: Omit<
      TransactionIntent,
      'id' | 'status' | 'transactionHash' | 'replacedByHash' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<TransactionIntent> {
    const result = await this.query.query<IntentRow>(
      `INSERT INTO transaction_intents (
         id, user_id, wallet_id, chain_id, kind, idempotency_key, request_fingerprint, target_address
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, idempotency_key) DO UPDATE
         SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING *`,
      [
        randomUUID(),
        input.userId,
        input.walletId,
        input.chainId,
        input.kind,
        input.idempotencyKey,
        input.requestFingerprint,
        input.targetAddress ? normalizeAddress(input.targetAddress) : null,
      ],
    )
    const intent = mapIntent(result.rows[0])
    if (intent.requestFingerprint !== input.requestFingerprint) {
      throw new IdempotencyConflictError()
    }
    return intent
  }

  async markBroadcast(id: string, transactionHash: Hash): Promise<TransactionIntent | null> {
    const result = await this.query.query<IntentRow>(
      `UPDATE transaction_intents
       SET status = 'broadcast', transaction_hash = $2, updated_at = now()
       WHERE id = $1 AND status = 'created'
       RETURNING *`,
      [id, transactionHash.toLowerCase()],
    )
    return result.rows[0] ? mapIntent(result.rows[0]) : null
  }

  async saveReceipt(input: ReceiptInput): Promise<void> {
    await this.transactions.withTransaction(async (transaction) => {
      await transaction.query(
        `INSERT INTO transaction_receipts (
           id, intent_id, chain_id, transaction_hash, status, block_number, gas_used,
           effective_gas_price
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (intent_id) DO UPDATE SET
           transaction_hash = EXCLUDED.transaction_hash,
           status = EXCLUDED.status,
           block_number = EXCLUDED.block_number,
           gas_used = EXCLUDED.gas_used,
           effective_gas_price = EXCLUDED.effective_gas_price,
           observed_at = now()`,
        [
          randomUUID(),
          input.intentId,
          input.chainId,
          input.transactionHash.toLowerCase(),
          input.status,
          input.blockNumber.toString(),
          input.gasUsed.toString(),
          input.effectiveGasPrice?.toString() ?? null,
        ],
      )
      await transaction.query(
        `UPDATE transaction_intents
         SET status = $2, updated_at = now()
         WHERE id = $1`,
        [input.intentId, input.status === 'success' ? 'confirmed' : 'reverted'],
      )
    })
  }
}

export class PostgresRiskReportRepository {
  constructor(private readonly query: QueryExecutor) {}

  async create(input: RiskReportInput): Promise<string> {
    const id = randomUUID()
    await this.query.query(
      `INSERT INTO risk_reports (
         id, user_id, wallet_id, intent_id, chain_id, operation, target_address,
         finding_codes, highest_severity, decision
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.userId,
        input.walletId,
        input.intentId,
        input.chainId,
        input.operation,
        input.targetAddress ? normalizeAddress(input.targetAddress) : null,
        input.findingCodes,
        input.highestSeverity,
        input.decision,
      ],
    )
    return id
  }
}
