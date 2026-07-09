import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

// 这就是你的"邮差"，整个App共用这一个，不用每次都重新创建
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_ALCHEMY_URL),
})