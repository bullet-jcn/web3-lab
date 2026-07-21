'use client'
import SignInWithEthereum from '@/components/auth/SignInWithEthereum'
import WatchlistPanel from '@/components/watchlist/WatchlistPanel'
import { WalletConnectPanel } from '@/components/wallet/WalletConnectPanel'
import { MultiChainBalances } from '@/components/wallet/MultiChainBalances'
import { BatchedTransferDemo } from '@/components/token/BatchedTransferDemo'
import { TokenTransferPanel } from '@/components/token/TokenTransferPanel'
import { ApprovalRiskDemo } from '@/components/token/ApprovalRiskDemo'
import { Section } from '@/components/ui/Section'

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold">web3-lab</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          SIWE 登录 · 关注列表 · EIP-5792 原子批量转账 · 多链余额
        </p>
      </header>

      <Section title="登录">
        <SignInWithEthereum />
      </Section>

      <Section title="关注列表">
        <WatchlistPanel />
      </Section>

      <Section title="钱包连接">
        <WalletConnectPanel />
      </Section>

      <Section title="多链余额">
        <MultiChainBalances />
      </Section>

      <Section title="批量转账 (EIP-5792)">
        <BatchedTransferDemo />
      </Section>

      <Section title="单笔转账 / 发送 ETH">
        <TokenTransferPanel />
      </Section>

      <Section title="AI 安全副驾驶：签名前风险检测">
        <ApprovalRiskDemo />
      </Section>
    </main>
  )
}
