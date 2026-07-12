const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

// Alchemy 用同一个 key 覆盖所有网络，区别只在子域名，因此这里统一派生，
// 避免每条链各自散落一条完整 URL、维护时改一处漏一处。
export const rpcUrls = {
  sepolia: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  mainnet: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  baseSepolia: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  base: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
} as const
