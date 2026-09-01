import { describe, expect, it } from 'vitest'
import { encodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import { sepolia } from 'viem/chains'
import { SEPOLIA_USDC_ASSET } from './assetRegistry'
import { analyzeCalldata, MAX_CALLDATA_BYTES, MAX_DECODED_PERMISSION_CHANGES } from './calldataAnalysis'
import { DEMO_SPENDER_ADDRESS } from './constants'
import { permit2AllowanceAbi } from './permit2'
import { CANONICAL_PERMIT2_ADDRESS } from './permit2Registry'

const UNKNOWN_ADDRESS = '0x0000000000000000000000000000000000000001'

function approveData(amount: bigint) {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [DEMO_SPENDER_ADDRESS, amount],
  })
}

function lockdownData(pairs: readonly { token: `0x${string}`; spender: `0x${string}` }[]) {
  return encodeFunctionData({
    abi: permit2AllowanceAbi,
    functionName: 'lockdown',
    args: [pairs],
  })
}

describe('calldata analysis', () => {
  it('decodes a registered ERC-20 approve and applies token decimals', () => {
    const result = analyzeCalldata({
      chainId: sepolia.id,
      to: SEPOLIA_USDC_ASSET.address,
      data: approveData(BigInt(1_500_000)),
    })

    expect(result).toEqual({
      status: 'decoded',
      call: expect.objectContaining({
        kind: 'erc20-approve',
        asset: SEPOLIA_USDC_ASSET,
        spender: DEMO_SPENDER_ADDRESS,
        amount: BigInt(1_500_000),
        formattedAmount: '1.5',
        effect: 'set-allowance',
        isUnlimited: false,
        riskFindings: [],
      }),
    })
  })

  it('distinguishes revoke and unlimited approve effects deterministically', () => {
    const revoke = analyzeCalldata({ chainId: sepolia.id, to: SEPOLIA_USDC_ASSET.address, data: approveData(BigInt(0)) })
    const unlimited = analyzeCalldata({ chainId: sepolia.id, to: SEPOLIA_USDC_ASSET.address, data: approveData(maxUint256) })

    expect(revoke.status === 'decoded' && revoke.call.kind === 'erc20-approve' && revoke.call.effect).toBe('revoke')
    expect(unlimited.status === 'decoded' && unlimited.call.kind === 'erc20-approve' && unlimited.call.isUnlimited).toBe(true)
    expect(unlimited.status === 'decoded' && unlimited.call.kind === 'erc20-approve' && unlimited.call.riskFindings).toEqual([
      { severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender: DEMO_SPENDER_ADDRESS } },
    ])
  })

  it('decodes only registered Permit2 lockdown tuples and preserves their order', () => {
    const data = lockdownData([
      { token: SEPOLIA_USDC_ASSET.address, spender: DEMO_SPENDER_ADDRESS },
      { token: SEPOLIA_USDC_ASSET.address, spender: DEMO_SPENDER_ADDRESS },
    ])
    const result = analyzeCalldata({ chainId: sepolia.id, to: CANONICAL_PERMIT2_ADDRESS, data })

    expect(result.status).toBe('decoded')
    if (result.status !== 'decoded' || result.call.kind !== 'permit2-lockdown') return
    expect(result.call.effect).toBe('clear-internal-allowances')
    expect(result.call.pairs).toHaveLength(2)
    expect(result.call.pairs[0]).toEqual(expect.objectContaining({
      targetId: 'sepolia-usdc-demo-spender-permit2',
      tokenName: 'USD Coin',
      spender: DEMO_SPENDER_ADDRESS,
    }))
    expect(Object.isFrozen(result.call)).toBe(true)
    expect(Object.isFrozen(result.call.pairs)).toBe(true)
  })

  it('identifies an empty Permit2 lockdown as a decoded no-op', () => {
    const result = analyzeCalldata({
      chainId: sepolia.id,
      to: CANONICAL_PERMIT2_ADDRESS,
      data: lockdownData([]),
    })

    expect(result).toEqual({
      status: 'decoded',
      call: expect.objectContaining({ kind: 'permit2-lockdown', effect: 'no-op', pairs: [] }),
    })
  })

  it('fails closed for an unregistered Permit2 token/spender tuple', () => {
    const result = analyzeCalldata({
      chainId: sepolia.id,
      to: CANONICAL_PERMIT2_ADDRESS,
      data: lockdownData([{ token: SEPOLIA_USDC_ASSET.address, spender: UNKNOWN_ADDRESS }]),
    })

    expect(result).toEqual(expect.objectContaining({ status: 'unsupported', code: 'UNSUPPORTED_PERMISSION_TARGET' }))
  })

  it('rejects invalid targets, odd hex, missing selectors, and oversized calldata', () => {
    expect(analyzeCalldata({ chainId: sepolia.id, to: 'bad', data: approveData(BigInt(1)) })).toEqual(
      expect.objectContaining({ status: 'invalid', code: 'INVALID_TARGET' }),
    )
    expect(analyzeCalldata({ chainId: sepolia.id, to: SEPOLIA_USDC_ASSET.address, data: '0x123' })).toEqual(
      expect.objectContaining({ status: 'invalid', code: 'INVALID_CALLDATA' }),
    )
    expect(analyzeCalldata({ chainId: sepolia.id, to: SEPOLIA_USDC_ASSET.address, data: '0x1234' })).toEqual(
      expect.objectContaining({ status: 'invalid', code: 'INVALID_CALLDATA' }),
    )
    expect(analyzeCalldata({
      chainId: sepolia.id,
      to: SEPOLIA_USDC_ASSET.address,
      data: `0x${'00'.repeat(MAX_CALLDATA_BYTES + 1)}`,
    })).toEqual(expect.objectContaining({ status: 'invalid', code: 'CALLDATA_TOO_LARGE' }))
  })

  it('distinguishes unsupported selectors from malformed supported calls', () => {
    const transfer = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [DEMO_SPENDER_ADDRESS, BigInt(1)],
    })
    expect(analyzeCalldata({ chainId: sepolia.id, to: SEPOLIA_USDC_ASSET.address, data: transfer })).toEqual(
      expect.objectContaining({ status: 'unsupported', code: 'UNSUPPORTED_FUNCTION' }),
    )
    expect(analyzeCalldata({
      chainId: sepolia.id,
      to: SEPOLIA_USDC_ASSET.address,
      data: approveData(BigInt(1)).slice(0, 20),
    })).toEqual(expect.objectContaining({ status: 'invalid', code: 'MALFORMED_SUPPORTED_CALL' }))
  })

  it('rejects unknown chains, contracts, and excessively large decoded batches', () => {
    expect(analyzeCalldata({ chainId: 1, to: SEPOLIA_USDC_ASSET.address, data: approveData(BigInt(1)) })).toEqual(
      expect.objectContaining({ status: 'unsupported', code: 'UNSUPPORTED_CHAIN' }),
    )
    expect(analyzeCalldata({ chainId: sepolia.id, to: UNKNOWN_ADDRESS, data: approveData(BigInt(1)) })).toEqual(
      expect.objectContaining({ status: 'unsupported', code: 'UNSUPPORTED_CONTRACT' }),
    )
    const pairs = Array.from({ length: MAX_DECODED_PERMISSION_CHANGES + 1 }, () => ({
      token: SEPOLIA_USDC_ASSET.address,
      spender: DEMO_SPENDER_ADDRESS,
    }))
    expect(analyzeCalldata({ chainId: sepolia.id, to: CANONICAL_PERMIT2_ADDRESS, data: lockdownData(pairs) })).toEqual(
      expect.objectContaining({ status: 'unsupported', code: 'TOO_MANY_PERMISSION_CHANGES' }),
    )
  })
})
