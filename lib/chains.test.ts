import { describe, expect, it } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import { isWriteChain, WALLET_CHAINS, WRITE_CHAIN } from './chains'

describe('chain registry', () => {
  it('uses the same declared chains for wallet configuration', () => {
    expect(WALLET_CHAINS.map((chain) => chain.id)).toEqual([sepolia.id, mainnet.id])
  })

  it('keeps production write actions on the explicit testnet chain', () => {
    expect(WRITE_CHAIN.id).toBe(sepolia.id)
    expect(isWriteChain(sepolia.id)).toBe(true)
    expect(isWriteChain(mainnet.id)).toBe(false)
    expect(isWriteChain(undefined)).toBe(false)
  })
})
