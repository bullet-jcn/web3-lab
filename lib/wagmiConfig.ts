import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { WALLET_CHAINS } from './chains'
import { rpcUrls } from './rpc'

export const config = createConfig({
  chains: WALLET_CHAINS,
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(rpcUrls.sepolia),
    [mainnet.id]: http(rpcUrls.mainnet),
  },
  ssr: true,
})
