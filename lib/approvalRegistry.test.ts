import { describe, expect, it } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import {
  getTrackedErc20ApprovalTarget,
  listTrackedErc20ApprovalTargets,
} from './approvalRegistry'

describe('approval registry', () => {
  it('binds a tracked spender to a registered asset and chain', () => {
    const targets = listTrackedErc20ApprovalTargets(sepolia.id)

    expect(targets).toHaveLength(1)
    expect(targets[0]).toEqual(expect.objectContaining({
      id: 'sepolia-usdc-demo-spender',
      kind: 'erc20',
      chainId: sepolia.id,
      spenderLabel: 'Web3 Lab 测试 Spender',
      source: 'app-registry',
    }))
    expect(targets[0]?.asset).toEqual(expect.objectContaining({
      id: 'usdc',
      chainId: sepolia.id,
      symbol: 'USDC',
    }))
    expect(Object.isFrozen(targets)).toBe(true)
    expect(Object.isFrozen(targets[0])).toBe(true)
  })

  it('fails closed for unknown chains and target selectors', () => {
    expect(listTrackedErc20ApprovalTargets(mainnet.id)).toEqual([])
    expect(listTrackedErc20ApprovalTargets(undefined)).toEqual([])
    expect(getTrackedErc20ApprovalTarget(sepolia.id, 'unknown')).toBeUndefined()
    expect(getTrackedErc20ApprovalTarget(sepolia.id, 'toString')).toBeUndefined()
    expect(getTrackedErc20ApprovalTarget(mainnet.id, 'sepolia-usdc-demo-spender')).toBeUndefined()
  })
})
