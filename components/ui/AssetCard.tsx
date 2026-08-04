import { Activity, CircleDot } from 'lucide-react'

interface AssetCardProps {
  chainName: string
  balance: string | null
  isLoading: boolean
  error?: string
}

export function AssetCard({ chainName, balance, isLoading, error }: AssetCardProps) {
  return (
    <div className="group rounded-xl border border-foreground/8 bg-foreground/[0.025] p-4 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/[0.025]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15 dark:text-indigo-300">
            <CircleDot className="size-3.5" />
          </span>
          <h3 className="text-sm font-medium">{chainName}</h3>
        </div>
        <Activity className="size-3.5 text-muted-foreground/50" />
      </div>
      {isLoading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-white/5" />
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <p className="font-mono text-xl font-semibold tracking-tight">{balance ?? '—'}</p>
          <span className="font-mono text-[10px] text-muted-foreground">ETH</span>
        </div>
      )}
    </div>
  )
}
