import { ApprovalRiskDemo } from '@/components/token/ApprovalRiskDemo'
import { ApprovalInventory } from '@/components/token/ApprovalInventory'
import { Permit2ApprovalInventory } from '@/components/token/Permit2ApprovalInventory'
import { BatchedTransferDemo } from '@/components/token/BatchedTransferDemo'
import { TokenTransferPanel } from '@/components/token/TokenTransferPanel'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Section } from '@/components/ui/Section'
import { WalletConnectPanel } from '@/components/wallet/WalletConnectPanel'
import { MultiChainBalances } from '@/components/wallet/MultiChainBalances'
import WatchlistPanel from '@/components/watchlist/WatchlistPanel'
import SignInWithEthereum from '@/components/auth/SignInWithEthereum'
import {
  ArrowLeftRight,
  Bot,
  Boxes,
  CircleDot,
  Eye,
  Fingerprint,
  FlaskConical,
  Radio,
  Send,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'

const features = [
  { label: 'SIWE', detail: '链上身份' },
  { label: 'EIP-5792', detail: '原子调用' },
  { label: 'MULTICHAIN', detail: '多链资产' },
]

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,oklch(0.72_0.17_155/0.12),transparent_28%),radial-gradient(circle_at_85%_5%,oklch(0.64_0.2_265/0.13),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.025)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <nav className="mb-12 flex items-center justify-between sm:mb-16">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 shadow-[0_0_24px_oklch(0.72_0.17_155/0.12)] dark:text-emerald-300">
              <FlaskConical className="size-4.5" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">web3/lab</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Onchain playground</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-emerald-600 dark:text-emerald-300 sm:inline-flex">
              <CircleDot className="size-3 fill-current" /> Sepolia ready
            </Badge>
            <ThemeToggle />
          </div>
        </nav>

        <header className="mb-12 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
              <Radio className="size-3.5" /> Build · Sign · Ship
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              你的链上能力，
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">在一个工作台完成。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              从钱包身份到安全授权，用真实的 EVM 能力验证下一代账户体验。专注实验，也为生产环境做好准备。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-foreground/8 bg-foreground/8 lg:w-[360px]">
            {features.map((feature) => (
              <div key={feature.label} className="bg-background/85 px-3 py-4 backdrop-blur-xl">
                <p className="font-mono text-[10px] font-semibold text-foreground">{feature.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{feature.detail}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="mb-5 flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Workspace / 01</span>
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-5">
            <Section icon={WalletCards} eyebrow="Connection" title="钱包连接" description="连接浏览器钱包并切换目标网络。">
              <WalletConnectPanel />
            </Section>
            <Section icon={Fingerprint} eyebrow="Identity" title="以太坊登录" description="使用 SIWE 建立可验证的链上会话。">
              <SignInWithEthereum />
            </Section>
            <Section icon={Eye} eyebrow="Monitor" title="地址关注列表" description="保存并快速追踪常用链上地址。">
              <WatchlistPanel />
            </Section>
          </div>

          <div className="space-y-5 lg:col-span-7">
            <Section icon={Boxes} eyebrow="Portfolio" title="多链资产" description="同时读取多个 EVM 网络的原生资产余额.">
              <MultiChainBalances />
            </Section>
            <div className="grid gap-5 sm:grid-cols-2">
              <Section icon={ArrowLeftRight} eyebrow="EIP-5792" title="原子批量转账" description="一次签名，完成多笔调用。">
                <BatchedTransferDemo />
              </Section>
              <Section icon={Send} eyebrow="Transfer" title="发送资产" description="模拟 ERC-20 与原生 ETH 转账。">
                <TokenTransferPanel />
              </Section>
            </div>
            <Section icon={Bot} eyebrow="Approval Security" title="授权清单与签名前风险" description="读取已登记授权，并识别无限授权等高风险交易意图。" accent>
              <ApprovalInventory />
              <div className="my-5 h-px bg-foreground/10" />
              <Permit2ApprovalInventory />
              <div className="my-5 h-px bg-foreground/10" />
              <p className="mb-3 text-sm font-medium">测试网授权风险演示</p>
              <ApprovalRiskDemo />
            </Section>
          </div>
        </div>

        <footer className="mt-10 flex flex-col gap-3 border-t border-foreground/8 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-300" /> 非托管 · 所有交易均由你的钱包确认</p>
          <p className="font-mono">POWERED BY WAGMI / VIEM / SHADCN</p>
        </footer>
      </div>
    </main>
  )
}
