import { createPublicClient } from 'viem'
import { sepolia, baseSepolia, mainnet, base } from 'viem/chains'
import { createRpcTransport, getRpcProviders } from './rpc'

// Ethereum Sepolia
export const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: createRpcTransport(getRpcProviders(sepolia.id)),
})

// Base Sepolia
export const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: createRpcTransport(getRpcProviders(baseSepolia.id)),
})

// Ethereum Mainnet
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: createRpcTransport(getRpcProviders(mainnet.id)),
})

// Base Mainnet
export const baseClient = createPublicClient({
  chain: base,
  transport: createRpcTransport(getRpcProviders(base.id)),
})
