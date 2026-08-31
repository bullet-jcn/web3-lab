import { describe, expect, it } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import { getSupportedErc20Asset, listSupportedErc20Assets } from './assetRegistry'

describe('ERC-20 asset registry', () => {
  it('binds each supported asset to its chain and deterministic metadata', () => {
    expect(listSupportedErc20Assets(sepolia.id)).toEqual([
      expect.objectContaining({
        id: 'usdc',
        chainId: sepolia.id,
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      }),
    ])
    expect(Object.isFrozen(getSupportedErc20Asset(sepolia.id, 'usdc'))).toBe(true)
  })

  it('fails closed for unknown chains and asset selectors', () => {
    expect(getSupportedErc20Asset(mainnet.id, 'usdc')).toBeUndefined()
    expect(getSupportedErc20Asset(sepolia.id, 'attacker-controlled-address')).toBeUndefined()
    expect(getSupportedErc20Asset(sepolia.id, 'toString')).toBeUndefined()
    expect(getSupportedErc20Asset(undefined, 'usdc')).toBeUndefined()
    expect(listSupportedErc20Assets(mainnet.id)).toEqual([])
  })
})
