import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'
import { baseClient, baseSepoliaClient, mainnetClient, sepoliaClient } from './viemClient'

const CHAIN_CONFIGS = {
  testnet: [
    { id: 'sepolia', name: 'Ethereum Sepolia', client: sepoliaClient, chainId: sepolia.id },
    { id: 'baseSepolia', name: 'Base Sepolia', client: baseSepoliaClient, chainId: baseSepolia.id },
  ],
  mainnet: [
    { id: 'ethereum', name: 'Ethereum', client: mainnetClient, chainId: mainnet.id },
    { id: 'base', name: 'Base', client: baseClient, chainId: base.id },
  ],
} as const

// 这个项目目前用测试版，以后想切生产环境，改这一行就够了
const ACTIVE_CHAINS = CHAIN_CONFIGS.testnet

type ChainBalanceConfig = (typeof CHAIN_CONFIGS)[keyof typeof CHAIN_CONFIGS][number]

export { ACTIVE_CHAINS }
export type { ChainBalanceConfig }