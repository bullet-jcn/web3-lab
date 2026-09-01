import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { loadRiskDecisions, saveRiskDecision } from './riskDecisionStorage'

const account = '0x0000000000000000000000000000000000000001' as Address
const target = '0x0000000000000000000000000000000000000002' as Address
const spender = '0x0000000000000000000000000000000000000003' as Address
function memory() { const values = new Map<string, string>(); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } }

describe('risk decision storage', () => {
  it('stores only bounded public evidence codes and an explicit decision', () => { const storage = memory(); saveRiskDecision(storage, { account, chainId: 11155111, operation: 'erc20-approve', target, spender, findingCodes: ['UNLIMITED_APPROVAL'], decision: 'proceeded-to-wallet' }, 1_000); expect(loadRiskDecisions(storage, { account, chainId: 11155111 }, 2_000)[0]).toEqual({ version: 1, account, chainId: 11155111, operation: 'erc20-approve', target, spender, findingCodes: ['UNLIMITED_APPROVAL'], decision: 'proceeded-to-wallet', createdAt: 1_000 }); expect([...storage.values.values()][0]).not.toContain('signature') })
  it('isolates wallet context and discards tampered data', () => { const storage = memory(); saveRiskDecision(storage, { account, chainId: 11155111, operation: 'erc20-approve', target, spender, findingCodes: ['UNLIMITED_APPROVAL'], decision: 'cancelled' }, 1_000); expect(loadRiskDecisions(storage, { account, chainId: 1 }, 2_000)).toEqual([]); const [key, raw] = [...storage.values.entries()][0]; storage.values.set(key, raw.replace('UNLIMITED_APPROVAL', 'INVENTED')); expect(loadRiskDecisions(storage, { account, chainId: 11155111 }, 2_000)).toEqual([]) })
  it('expires records after ninety days', () => { const storage = memory(); saveRiskDecision(storage, { account, chainId: 11155111, operation: 'erc20-approve', target, spender, findingCodes: ['UNLIMITED_APPROVAL'], decision: 'cancelled' }, 1_000); expect(loadRiskDecisions(storage, { account, chainId: 11155111 }, 1_000 + 90 * 24 * 60 * 60 * 1_000 + 1)).toEqual([]) })
})
