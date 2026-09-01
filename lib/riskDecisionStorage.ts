import { getAddress, isAddress, type Address } from 'viem'
import type { RiskFinding } from './riskCheck'

const VERSION = 1
const MAX_RECORDS = 50
const TTL_MS = 90 * 24 * 60 * 60 * 1_000
const CODES = new Set<RiskFinding['code']>(['UNLIMITED_APPROVAL', 'HIGH_APPROVAL', 'UNRECOGNIZED_SPENDER', 'ACCOUNT_MISMATCH', 'CHAIN_MISMATCH', 'EXPIRED_DEADLINE'])

export interface RiskDecisionRecord {
  readonly version: typeof VERSION
  readonly account: Address
  readonly chainId: number
  readonly operation: 'erc20-approve'
  readonly target: Address
  readonly spender: Address
  readonly findingCodes: readonly RiskFinding['code'][]
  readonly decision: 'proceeded-to-wallet' | 'cancelled'
  readonly createdAt: number
}

function key(account: Address, chainId: number) { return `web3-lab:risk-decisions:v${VERSION}:${chainId}:${account.toLowerCase()}` }
function valid(value: unknown, account: Address, chainId: number, now: number): value is RiskDecisionRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.version === VERSION && typeof item.account === 'string' && isAddress(item.account) && item.account.toLowerCase() === account.toLowerCase()
    && item.chainId === chainId && item.operation === 'erc20-approve'
    && typeof item.target === 'string' && isAddress(item.target) && typeof item.spender === 'string' && isAddress(item.spender)
    && Array.isArray(item.findingCodes) && item.findingCodes.length > 0 && item.findingCodes.length <= 10 && item.findingCodes.every((code) => typeof code === 'string' && CODES.has(code as RiskFinding['code']))
    && (item.decision === 'proceeded-to-wallet' || item.decision === 'cancelled')
    && typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) && item.createdAt <= now && now - item.createdAt <= TTL_MS
}

export function loadRiskDecisions(storage: Pick<Storage, 'getItem' | 'removeItem'>, context: { readonly account: Address; readonly chainId: number }, now = Date.now()): readonly RiskDecisionRecord[] {
  const storageKey = key(context.account, context.chainId); const raw = storage.getItem(storageKey); if (!raw) return []
  try { const value: unknown = JSON.parse(raw); if (Array.isArray(value) && value.length <= MAX_RECORDS && value.every((item) => valid(item, context.account, context.chainId, now))) return value } catch { /* discard below */ }
  storage.removeItem(storageKey); return []
}

export function saveRiskDecision(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, input: Omit<RiskDecisionRecord, 'version' | 'createdAt' | 'findingCodes'> & { readonly findingCodes: readonly RiskFinding['code'][] }, now = Date.now()): RiskDecisionRecord {
  const record: RiskDecisionRecord = Object.freeze({ version: VERSION, account: getAddress(input.account), chainId: input.chainId, operation: input.operation, target: getAddress(input.target), spender: getAddress(input.spender), findingCodes: Object.freeze([...new Set(input.findingCodes)]), decision: input.decision, createdAt: now })
  if (!valid(record, record.account, record.chainId, now)) throw new Error('invalid risk decision')
  const current = loadRiskDecisions(storage, { account: record.account, chainId: record.chainId }, now)
  storage.setItem(key(record.account, record.chainId), JSON.stringify([record, ...current].slice(0, MAX_RECORDS)))
  return record
}
