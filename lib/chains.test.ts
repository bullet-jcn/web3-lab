import { describe, expect, it } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import { getTransactionExplorerUrl, isWriteChain, WALLET_CHAINS, WRITE_CHAIN } from './chains'

const transactionHash = `0x${'ab'.repeat(32)}` as const

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

  it('builds transaction evidence links from the active chain registry', () => {
    expect(getTransactionExplorerUrl(sepolia.id, transactionHash)).toBe(
      `https://sepolia.etherscan.io/tx/${transactionHash}`,
    )
    expect(getTransactionExplorerUrl(mainnet.id, transactionHash)).toBeUndefined()
    expect(getTransactionExplorerUrl(undefined, transactionHash)).toBeUndefined()
  })
})
