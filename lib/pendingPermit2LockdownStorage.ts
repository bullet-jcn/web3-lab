import { isAddress, isHex, type Address, type Hash } from 'viem'
import { PENDING_TRANSACTION_TTL_MS } from './pendingTransactionStorage'

const STORAGE_VERSION = 1
const MAX_TARGET_ID_LENGTH = 100
const TARGET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface PendingPermit2LockdownRecord {
  readonly version: typeof STORAGE_VERSION
  readonly account: Address
  readonly chainId: number
  readonly targetId: string
  readonly hash: Hash
  readonly createdAt: number
}

interface PendingPermit2LockdownContext {
  readonly account: Address
  readonly chainId: number
}

function storageKey({ account, chainId }: PendingPermit2LockdownContext): string {
  return `web3-lab:pending-permit2-lockdown:v${STORAGE_VERSION}:${chainId}:${account.toLowerCase()}`
}

function isValidTargetId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_TARGET_ID_LENGTH
    && TARGET_ID_PATTERN.test(value)
}

function isPendingPermit2LockdownRecord(
  value: unknown,
  context: PendingPermit2LockdownContext,
  now: number,
  ttlMs: number,
): value is PendingPermit2LockdownRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>

  return record.version === STORAGE_VERSION
    && typeof record.account === 'string'
    && isAddress(record.account)
    && record.account.toLowerCase() === context.account.toLowerCase()
    && record.chainId === context.chainId
    && isValidTargetId(record.targetId)
    && typeof record.hash === 'string'
    && isHex(record.hash, { strict: true })
    && record.hash.length === 66
    && typeof record.createdAt === 'number'
    && Number.isFinite(record.createdAt)
    && record.createdAt <= now
    && now - record.createdAt <= ttlMs
}

export function savePendingPermit2Lockdown(
  storage: Pick<Storage, 'setItem'>,
  lockdown: Omit<PendingPermit2LockdownRecord, 'version' | 'createdAt'>,
  now = Date.now(),
): PendingPermit2LockdownRecord {
  const record: PendingPermit2LockdownRecord = {
    version: STORAGE_VERSION,
    ...lockdown,
    createdAt: now,
  }
  storage.setItem(storageKey(lockdown), JSON.stringify(record))
  return record
}

export function loadPendingPermit2Lockdown(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  context: PendingPermit2LockdownContext,
  options: { readonly now?: number; readonly ttlMs?: number } = {},
): PendingPermit2LockdownRecord | null {
  const key = storageKey(context)
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    const value: unknown = JSON.parse(raw)
    if (isPendingPermit2LockdownRecord(
      value,
      context,
      options.now ?? Date.now(),
      options.ttlMs ?? PENDING_TRANSACTION_TTL_MS,
    )) return value
  } catch {
    // Browser storage is untrusted input; invalid records are discarded below.
  }

  storage.removeItem(key)
  return null
}

export function clearPendingPermit2Lockdown(
  storage: Pick<Storage, 'removeItem'>,
  context: PendingPermit2LockdownContext,
): void {
  storage.removeItem(storageKey(context))
}
