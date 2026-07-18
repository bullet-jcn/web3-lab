'use client'
import SignInWithEthereum from '@/components/auth/SignInWithEthereum'
import WatchlistPanel from '@/components/watchlist/WatchlistPanel'
import { WalletConnectPanel } from '@/components/wallet/WalletConnectPanel'
import { MultiChainBalances } from '@/components/wallet/MultiChainBalances'
import { BatchedTransferDemo } from '@/components/token/BatchedTransferDemo'
import { TokenTransferPanel } from '@/components/token/TokenTransferPanel'


export default function Home() {

  return (
    <div className="p-6 space-y-4">
      <SignInWithEthereum />
      <WatchlistPanel />
      <WalletConnectPanel />
      <MultiChainBalances />
      <BatchedTransferDemo />
      <TokenTransferPanel />
    </div>
  )
}
