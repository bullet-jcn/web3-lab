import { describe, expect, it } from 'vitest'
import { maxUint160, maxUint256, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import { DEMO_RECIPIENT_A, DEMO_SPENDER_ADDRESS } from './constants'
import { analyzeTypedDataJson, createEip2612Sample, createPermit2Sample } from './typedDataAnalysis'

const ACCOUNT = DEMO_RECIPIENT_A as Address
const OTHER = '0x0000000000000000000000000000000000000001' as Address

describe('typed data analysis', () => {
  it('decodes a verified EIP-2612 domain and hashes normalized data', () => {
    const result = analyzeTypedDataJson({ raw: createEip2612Sample(ACCOUNT, sepolia.id, BigInt(3_000)), activeAccount: ACCOUNT, activeChainId: sepolia.id, observedAt: BigInt(2_000) })
    expect(result.status).toBe('decoded')
    if (result.status !== 'decoded' || result.call.kind !== 'eip2612-permit') return
    expect(result.call).toEqual(expect.objectContaining({ owner: ACCOUNT, spender: DEMO_SPENDER_ADDRESS, value: maxUint256, isUnlimited: true, nonce: BigInt(0) }))
    expect(result.call.digest).toMatch(/^0x[0-9a-f]{64}$/)
    expect(result.call.riskFindings.map((finding) => finding.code)).toContain('UNLIMITED_APPROVAL')
  })

  it('detects wallet account and active-chain mismatches from signing context', () => {
    const result = analyzeTypedDataJson({ raw: createEip2612Sample(ACCOUNT, sepolia.id, BigInt(3_000)), activeAccount: OTHER, activeChainId: 1, observedAt: BigInt(2_000) })
    expect(result.status).toBe('decoded')
    if (result.status !== 'decoded') return
    expect(result.call.riskFindings.map((finding) => finding.code)).toEqual(expect.arrayContaining(['ACCOUNT_MISMATCH', 'CHAIN_MISMATCH']))
  })

  it('rejects an altered EIP-2612 domain version', () => {
    const value = JSON.parse(createEip2612Sample(ACCOUNT, sepolia.id, BigInt(3_000)))
    value.domain.version = '1'
    expect(analyzeTypedDataJson({ raw: JSON.stringify(value) })).toEqual(expect.objectContaining({ status: 'unsupported', code: 'DOMAIN_MISMATCH' }))
  })

  it('decodes Permit2 PermitSingle with uint160/uint48 widths', () => {
    const result = analyzeTypedDataJson({ raw: createPermit2Sample(sepolia.id, BigInt(3_000)), activeChainId: sepolia.id, observedAt: BigInt(2_000) })
    expect(result.status).toBe('decoded')
    if (result.status !== 'decoded' || result.call.kind !== 'permit2-permit-single') return
    expect(result.call).toEqual(expect.objectContaining({ amount: maxUint160, expiration: BigInt(3_000), nonce: BigInt(0), sigDeadline: BigInt(3_000), isUnlimited: true }))
    expect(result.call.riskFindings.map((finding) => finding.code)).toContain('UNLIMITED_APPROVAL')
  })

  it('flags an expired signing deadline using chain-observed time', () => {
    const result = analyzeTypedDataJson({ raw: createPermit2Sample(sepolia.id, BigInt(1_999)), observedAt: BigInt(2_000) })
    expect(result.status).toBe('decoded')
    if (result.status !== 'decoded') return
    expect(result.call.riskFindings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'EXPIRED_DEADLINE' })]))
  })

  it('rejects unknown primary types, malformed schemas, and out-of-range widths', () => {
    const unknown = JSON.parse(createPermit2Sample(sepolia.id, BigInt(3_000))); unknown.primaryType = 'Transfer'
    expect(analyzeTypedDataJson({ raw: JSON.stringify(unknown) })).toEqual(expect.objectContaining({ status: 'unsupported', code: 'UNSUPPORTED_PRIMARY_TYPE' }))
    const schema = JSON.parse(createPermit2Sample(sepolia.id, BigInt(3_000))); schema.types.PermitDetails[1].type = 'uint256'
    expect(analyzeTypedDataJson({ raw: JSON.stringify(schema) })).toEqual(expect.objectContaining({ status: 'unsupported', code: 'UNSUPPORTED_TYPED_SCHEMA' }))
    const width = JSON.parse(createPermit2Sample(sepolia.id, BigInt(3_000))); width.message.details.amount = (maxUint160 + BigInt(1)).toString()
    expect(analyzeTypedDataJson({ raw: JSON.stringify(width) })).toEqual(expect.objectContaining({ status: 'invalid', code: 'INVALID_TYPED_VALUE' }))
  })

  it('rejects invalid JSON and extra top-level fields', () => {
    expect(analyzeTypedDataJson({ raw: '{bad' })).toEqual(expect.objectContaining({ status: 'invalid', code: 'INVALID_JSON' }))
    const extra = JSON.parse(createEip2612Sample(ACCOUNT, sepolia.id, BigInt(3_000))); extra.signature = 'secret'
    expect(analyzeTypedDataJson({ raw: JSON.stringify(extra) })).toEqual(expect.objectContaining({ status: 'invalid', code: 'INVALID_TYPED_DATA' }))
  })

  it('rejects the zero owner forbidden by EIP-2612', () => {
    const value = JSON.parse(createEip2612Sample(ACCOUNT, sepolia.id, BigInt(3_000)))
    value.message.owner = '0x0000000000000000000000000000000000000000'
    expect(analyzeTypedDataJson({ raw: JSON.stringify(value) })).toEqual(expect.objectContaining({ status: 'invalid', code: 'INVALID_TYPED_VALUE' }))
  })
})
