import { describe, expect, it } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import {
  CANONICAL_PERMIT2_ADDRESS,
  getTrackedPermit2AllowanceTarget,
  listTrackedPermit2AllowanceTargets,
} from './permit2Registry'

describe('Permit2 approval registry', () => {
  it('binds the canonical deployment, asset, spender, and verified runtime code hash to Sepolia', () => {
    const targets = listTrackedPermit2AllowanceTargets(sepolia.id)

    expect(targets).toHaveLength(1)
    expect(targets[0]).toEqual(expect.objectContaining({
      id: 'sepolia-usdc-demo-spender-permit2',
      kind: 'permit2-allowance',
      chainId: sepolia.id,
      permit2Address: CANONICAL_PERMIT2_ADDRESS,
      permit2RuntimeCodeHash: '0x96d9f5c3f0fb0423426b7f970186235b7347027f4e5c19c40c412b7d97fc3751',
      spenderLabel: 'Web3 Lab 测试 Spender',
      source: 'app-registry',
    }))
    expect(targets[0]?.asset).toEqual(expect.objectContaining({ id: 'usdc', chainId: sepolia.id }))
    expect(Object.isFrozen(targets)).toBe(true)
    expect(Object.isFrozen(targets[0])).toBe(true)
  })

  it('fails closed for unknown chains and selectors', () => {
    expect(listTrackedPermit2AllowanceTargets(mainnet.id)).toEqual([])
    expect(listTrackedPermit2AllowanceTargets(undefined)).toEqual([])
    expect(getTrackedPermit2AllowanceTarget(sepolia.id, 'unknown')).toBeUndefined()
    expect(getTrackedPermit2AllowanceTarget(sepolia.id, 'toString')).toBeUndefined()
  })
})
