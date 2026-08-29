import { isAddress, isHex, type Address, type Hash } from 'viem'

const STORAGE_VERSION = 1
const MAX_ATOMIC_ID_LENGTH = 1_024
export const PENDING_BATCH_TTL_MS = 24 * 60 * 60 * 1000

export type PendingBatchMode = 'atomic' | 'sequential'
export type SequentialBatchStage = 'first-pending' | 'first-confirmed' | 'second-pending'

interface PendingBatchBase {
  version: typeof STORAGE_VERSION
  account: Address
  chainId: number
  createdAt: number
}

export interface PendingAtomicBatchRecord extends PendingBatchBase {
  mode: 'atomic'
  id: string
}

interface PendingSequentialBatchBase extends PendingBatchBase {
  mode: 'sequential'
  firstHash: Hash
}

export type PendingSequentialBatchRecord = PendingSequentialBatchBase & (
  | { stage: 'first-pending' | 'first-confirmed'; secondHash?: never }
  | { stage: 'second-pending'; secondHash: Hash }
)

export type PendingBatchRecord = PendingAtomicBatchRecord | PendingSequentialBatchRecord
export type PendingBatchInput = PendingBatchRecord extends infer Record
  ? Record extends PendingBatchRecord ? Omit<Record, 'version' | 'createdAt'> : never
  : never

export interface PendingBatchContext {
  account: Address
  chainId: number
  mode: PendingBatchMode
}

function storageKey({ account, chainId, mode }: PendingBatchContext): string {
  return `web3-lab:pending-batch:v${STORAGE_VERSION}:${chainId}:${account.toLowerCase()}:${mode}`
}

function hasValidBase(
  record: Record<string, unknown>,
  context: PendingBatchContext,
  now: number,
  ttlMs: number,
): boolean {
  return record.version === STORAGE_VERSION
    && typeof record.account === 'string'
    && isAddress(record.account)
    && record.account.toLowerCase() === context.account.toLowerCase()
    && record.chainId === context.chainId
    && record.mode === context.mode
    && typeof record.createdAt === 'number'
    && Number.isFinite(record.createdAt)
    && record.createdAt <= now
    && now - record.createdAt <= ttlMs
}

function isHash(value: unknown): value is Hash {
  return typeof value === 'string'
    && isHex(value, { strict: true })
    && value.length === 66
}

function isAtomicId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_ATOMIC_ID_LENGTH
    && value.trim().length > 0
    && !/[\u0000-\u001f\u007f]/.test(value)
}

function isPendingBatchRecord(
  value: unknown,
  context: PendingBatchContext,
  now: number,
  ttlMs: number,
): value is PendingBatchRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (!hasValidBase(record, context, now, ttlMs)) return false

  if (record.mode === 'atomic') return isAtomicId(record.id)
  if (record.mode !== 'sequential' || !isHash(record.firstHash)) return false

  if (record.stage === 'first-pending' || record.stage === 'first-confirmed') {
    return !('secondHash' in record)
  }
  return record.stage === 'second-pending' && isHash(record.secondHash)
}

export function savePendingBatch(
  storage: Pick<Storage, 'setItem'>,
  batch: PendingBatchInput,
  now = Date.now(),
): PendingBatchRecord {
  const record = {
    version: STORAGE_VERSION,
    ...batch,
    createdAt: now,
  } as PendingBatchRecord
  storage.setItem(storageKey(batch), JSON.stringify(record))
  return record
}

export function loadPendingBatch(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  context: PendingBatchContext,
  options: { now?: number; ttlMs?: number } = {},
): PendingBatchRecord | null {
  const key = storageKey(context)
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    const value: unknown = JSON.parse(raw)
    if (isPendingBatchRecord(
      value,
      context,
      options.now ?? Date.now(),
      options.ttlMs ?? PENDING_BATCH_TTL_MS,
    )) return value
  } catch {
    // Browser storage is untrusted input and invalid records are discarded below.
  }

  storage.removeItem(key)
  return null
}

export function clearPendingBatch(
  storage: Pick<Storage, 'removeItem'>,
  context: PendingBatchContext,
): void {
  storage.removeItem(storageKey(context))
}
