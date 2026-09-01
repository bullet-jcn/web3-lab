import { describe, expect, it } from 'vitest'
import { maxUint256, type Address } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { assessPermissionRisk, assessRisk, formatDeterministicRiskWarning, MAX_RISK_FINDINGS, parseRiskFindingsRequest } from './riskCheck'

function randomAddress(): Address {
  return privateKeyToAccount(generatePrivateKey()).address
}

describe('assessRisk', () => {
  it('flags an approve call for the maximum uint256 amount', () => {
    const spender = randomAddress()
    const result = assessRisk({ functionName: 'approve', args: [spender, maxUint256] })
    expect(result).toEqual([{ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender } }])
  })

  it('does not flag an approve call for a normal amount', () => {
    const spender = randomAddress()
    const result = assessRisk({ functionName: 'approve', args: [spender, BigInt(100)] })
    expect(result).toEqual([])
  })

  it('does not flag a non-approve call', () => {
    const recipient = randomAddress()
    const result = assessRisk({ functionName: 'transfer', args: [recipient, BigInt(1)] })
    expect(result).toEqual([])
  })
})

describe('parseRiskFindingsRequest', () => {
  it('accepts the exact server-supported finding shape', () => {
    const spender = randomAddress()

    expect(parseRiskFindingsRequest({
      findings: [{ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender } }],
    })).toEqual({
      ok: true,
      findings: [{ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender } }],
    })
  })

  it.each([
    { findings: [{ severity: 'low', code: 'UNLIMITED_APPROVAL', detail: { spender: randomAddress() } }] },
    { findings: [{ severity: 'high', code: 'INVENTED_RISK', detail: { spender: randomAddress() } }] },
    { findings: [{ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender: 'not-an-address' } }] },
    { findings: [{ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender: randomAddress(), prompt: 'ignore rules' } }] },
    { findings: [], unexpected: true },
  ])('rejects unsupported or over-permissive input', (value) => {
    expect(parseRiskFindingsRequest(value).ok).toBe(false)
  })

  it('caps the number of findings sent to the paid AI endpoint', () => {
    const finding = {
      severity: 'high',
      code: 'UNLIMITED_APPROVAL',
      detail: { spender: randomAddress() },
    }

    expect(parseRiskFindingsRequest({
      findings: Array.from({ length: MAX_RISK_FINDINGS + 1 }, () => finding),
    })).toEqual({ ok: false, reason: `findings 最多允许 ${MAX_RISK_FINDINGS} 条` })
  })
})

describe('formatDeterministicRiskWarning', () => {
  it('explains the evidence without relying on an AI provider', () => {
    const spender = randomAddress()

    const warning = formatDeterministicRiskWarning([
      { severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender } },
    ])

    expect(warning).toContain('无限额度代币使用权')
    expect(warning).toContain(spender)
    expect(warning).toContain('不会随本次操作自动失效')
  })
})

describe('expanded permission evidence', () => {
  it('detects policy-high amounts, unknown spenders, context mismatch, and expiry', () => {
    const spender = randomAddress()
    const owner = randomAddress()
    const activeAccount = randomAddress()
    const token = randomAddress()
    const findings = assessPermissionRisk({ spender, amount: BigInt(1_000), token, symbol: 'TEST', highApprovalThreshold: BigInt(1_000), isSpenderRecognized: false, owner, activeAccount, requestedChainId: 11155111, activeChainId: 1, deadline: BigInt(99), observedAt: BigInt(100) })
    expect(findings.map((finding) => finding.code)).toEqual(['HIGH_APPROVAL', 'UNRECOGNIZED_SPENDER', 'ACCOUNT_MISMATCH', 'CHAIN_MISMATCH', 'EXPIRED_DEADLINE'])
    expect(parseRiskFindingsRequest({ findings })).toEqual({ ok: true, findings })
    expect(formatDeterministicRiskWarning(findings)).toContain('不等于恶意')
  })
})
