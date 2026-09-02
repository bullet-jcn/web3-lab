import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(process.cwd(), 'migrations/0001_backend_foundation.sql')

describe('backend foundation migration', () => {
  it('defines every Milestone 4 durable entity', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    for (const table of [
      'users',
      'wallets',
      'sessions',
      'watchlist_entries',
      'transaction_intents',
      'transaction_receipts',
      'risk_reports',
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`)
    }
  })

  it('enforces wallet ownership, idempotency, and receipt context in the database', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('FOREIGN KEY (wallet_id, user_id)')
    expect(sql).toContain('UNIQUE (user_id, idempotency_key)')
    expect(sql).toContain('FOREIGN KEY (intent_id, chain_id, transaction_hash)')
    expect(sql).toContain('FOREIGN KEY (intent_id, user_id, wallet_id, chain_id)')
  })

  it('stores only hashed sessions and minimal deterministic risk evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('token_hash char(64) NOT NULL')
    expect(sql).toContain('sessions_chain_id_positive')
    expect(sql).toContain('finding_codes text[] NOT NULL')
    expect(sql).not.toMatch(/\btoken_value\b|\braw_calldata\b|\btyped_data\b|\bsignature\b|\bai_prose\b/)
  })
})
