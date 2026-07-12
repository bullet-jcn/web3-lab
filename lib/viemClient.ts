import { createPublicClient, http } from 'viem'
import { sepolia, baseSepolia, mainnet, base } from 'viem/chains'
import { rpcUrls } from './rpc'

// Ethereum Sepolia
export const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrls.sepolia),
})

// Base Sepolia
export const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrls.baseSepolia),
})

// Ethereum Mainnet
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrls.mainnet),
})

// Base Mainnet
export const baseClient = createPublicClient({
  chain: base,
  transport: http(rpcUrls.base),
})
