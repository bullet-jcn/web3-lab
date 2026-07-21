import { describe, expect, it } from 'vitest'
import { maxUint256, type Address } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { assessRisk } from './riskCheck'

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
