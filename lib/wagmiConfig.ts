import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { WALLET_CHAINS } from './chains'
import { rpcUrls } from './rpc'
import { normalizeWalletConnectProjectId } from './walletConnection'

export const walletConnectProjectId = normalizeWalletConnectProjectId(
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
)

const connectors = walletConnectProjectId
  ? [
      injected(),
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: true,
      }),
    ]
  : [injected()]

export const config = createConfig({
  chains: WALLET_CHAINS,
  connectors,
  transports: {
    [sepolia.id]: http(rpcUrls.sepolia),
    [mainnet.id]: http(rpcUrls.mainnet),
  },
  ssr: true,
})
