import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [sepolia, mainnet],
  connectors: [injected()],  // injected = "浏览器里已经装好的钱包插件"，MetaMask就是这一类
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_URL),
    [mainnet.id]: http(), // 没有单独配置主网 RPC key，先用 viem 内置的公共节点
  },
})