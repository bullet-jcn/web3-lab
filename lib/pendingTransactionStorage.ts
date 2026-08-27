import { isAddress, isHex, type Address, type Hash } from 'viem'

const STORAGE_VERSION = 1
export const PENDING_TRANSACTION_TTL_MS = 24 * 60 * 60 * 1000

export type PendingTransactionKind =
  | 'erc20-transfer'
  | 'native-transfer'
  | 'approval'
  | 'atomic-batch'

export interface PendingTransactionRecord {
  version: typeof STORAGE_VERSION
  account: Address
  chainId: number
  kind: PendingTransactionKind
  hash: Hash
  createdAt: number
}

interface PendingTransactionContext {
  account: Address
  chainId: number
  kind: PendingTransactionKind
}

function storageKey({ account, chainId, kind }: PendingTransactionContext): string {
  return `web3-lab:pending-tx:v${STORAGE_VERSION}:${chainId}:${account.toLowerCase()}:${kind}`
}

function isPendingTransactionRecord(
  value: unknown,
  context: PendingTransactionContext,
  now: number,
  ttlMs: number,
): value is PendingTransactionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>

  return record.version === STORAGE_VERSION
    && typeof record.account === 'string'
    && isAddress(record.account)
    && record.account.toLowerCase() === context.account.toLowerCase()
    && record.chainId === context.chainId
    && record.kind === context.kind
    && typeof record.hash === 'string'
    && isHex(record.hash, { strict: true })
    && record.hash.length === 66
    && typeof record.createdAt === 'number'
    && Number.isFinite(record.createdAt)
    && record.createdAt <= now
    && now - record.createdAt <= ttlMs
}

export function savePendingTransaction(
  storage: Pick<Storage, 'setItem'>,
  transaction: Omit<PendingTransactionRecord, 'version' | 'createdAt'>,
  now = Date.now(),
): PendingTransactionRecord {
  const record: PendingTransactionRecord = {
    version: STORAGE_VERSION,
    ...transaction,
    createdAt: now,
  }
  storage.setItem(storageKey(transaction), JSON.stringify(record))
  return record
}

export function loadPendingTransaction(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  context: PendingTransactionContext,
  options: { now?: number; ttlMs?: number } = {},
): PendingTransactionRecord | null {
  const key = storageKey(context)
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    const value: unknown = JSON.parse(raw)
    if (isPendingTransactionRecord(
      value,
      context,
      options.now ?? Date.now(),
      options.ttlMs ?? PENDING_TRANSACTION_TTL_MS,
    )) return value
  } catch {
    // Invalid browser storage is untrusted input and is discarded below.
  }

  storage.removeItem(key)
  return null
}

export function clearPendingTransaction(
  storage: Pick<Storage, 'removeItem'>,
  context: PendingTransactionContext,
): void {
  storage.removeItem(storageKey(context))
}
