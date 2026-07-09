import { createPublicClient, http } from 'viem'
import { sepolia, baseSepolia } from 'viem/chains'

// Ethereum Sepolia
export const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_ALCHEMY_URL),
})

// Base Sepolia
export const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
})
