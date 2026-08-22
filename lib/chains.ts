import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'
import { baseClient, baseSepoliaClient, mainnetClient, sepoliaClient } from './viemClient'

export const WALLET_CHAINS = [sepolia, mainnet] as const
export const WRITE_CHAIN = sepolia

const CHAIN_CONFIGS = {
  testnet: [
    { id: 'sepolia', name: 'Ethereum Sepolia', chain: sepolia, chainId: sepolia.id, client: sepoliaClient, writeEnabled: true },
    { id: 'baseSepolia', name: 'Base Sepolia', chain: baseSepolia, chainId: baseSepolia.id, client: baseSepoliaClient, writeEnabled: false },
  ],
  mainnet: [
    { id: 'ethereum', name: 'Ethereum', chain: mainnet, chainId: mainnet.id, client: mainnetClient, writeEnabled: false },
    { id: 'base', name: 'Base', chain: base, chainId: base.id, client: baseClient, writeEnabled: false },
  ],
} as const

// 这个项目目前用测试版，以后想切生产环境，改这一行就够了
const ACTIVE_CHAINS = CHAIN_CONFIGS.testnet

type ChainBalanceConfig = (typeof CHAIN_CONFIGS)[keyof typeof CHAIN_CONFIGS][number]

export function isWriteChain(chainId: number | undefined): boolean {
  return chainId === WRITE_CHAIN.id
}

export { ACTIVE_CHAINS }
export type { ChainBalanceConfig }
