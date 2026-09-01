'use client'

import { erc20Abi, zeroAddress } from 'viem'
import { useMemo } from 'react'
import { useConnection, useReadContracts } from 'wagmi'
import { Button } from '../ui/button'
import { WRITE_CHAIN } from '@/lib/chains'
import { listTrackedErc20ApprovalTargets } from '@/lib/approvalRegistry'
import {
  resolveErc20ApprovalSnapshots,
  type ApprovalContractReadResult,
  type ApprovalInventoryReadState,
} from '@/lib/approvalInventory'

export function ApprovalInventory() {
  const { address } = useConnection()
  const targets = listTrackedErc20ApprovalTargets(WRITE_CHAIN.id)
  const contracts = useMemo(() => targets.map((target) => ({
    address: target.asset.address,
    abi: erc20Abi,
    functionName: 'allowance' as const,
    args: [address ?? zeroAddress, target.spender] as const,
    chainId: target.chainId,
  })), [address, targets])
  const {
    data,
    error,
    isPending,
    isFetching,
    refetch,
  } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: Boolean(address) && contracts.length > 0 },
  })

  if (!address) {
    return <p className="text-sm text-muted-foreground">连接钱包后查看已登记范围内的授权</p>
  }

  let readState: ApprovalInventoryReadState
  if (error) {
    readState = { status: 'error' }
  } else if (isPending || !data) {
    readState = { status: 'loading' }
  } else {
    readState = {
      status: 'success',
      results: data as readonly ApprovalContractReadResult[],
    }
  }
  const snapshots = resolveErc20ApprovalSnapshots(targets, readState)

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
        <p className="text-sm font-medium">有限覆盖：应用 Approval Registry</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          这里只读取应用明确登记的 token / spender 组合，不是对该钱包全部历史授权的完整扫描。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          账户 <span className="font-mono text-foreground">{address}</span> · {WRITE_CHAIN.name}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? '读取中…' : '刷新授权清单'}
        </Button>
      </div>

      <div className="space-y-2">
        {snapshots.map((snapshot) => (
          <article key={snapshot.target.id} className="rounded-md border border-foreground/10 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{snapshot.target.asset.name} ({snapshot.target.asset.symbol})</p>
                <p className="mt-1 text-xs text-muted-foreground">{snapshot.target.spenderLabel}</p>
              </div>
              <span className="rounded-full bg-foreground/5 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">
                Registry
              </span>
            </div>
            <dl className="mt-3 space-y-1 text-xs">
              <div>
                <dt className="inline text-muted-foreground">Token: </dt>
                <dd className="inline break-all font-mono">{snapshot.target.asset.address}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground">Spender: </dt>
                <dd className="inline break-all font-mono">{snapshot.target.spender}</dd>
              </div>
            </dl>

            {snapshot.state === 'loading' && <p className="mt-3 text-muted-foreground">授权读取中…</p>}
            {snapshot.state === 'error' && (
              <p className="mt-3 text-destructive">授权读取失败；结果未知，不能当作零授权。</p>
            )}
            {snapshot.state === 'none' && (
              <p className="mt-3 text-muted-foreground">当前额度：0 {snapshot.target.asset.symbol}（未授权）</p>
            )}
            {snapshot.state === 'active' && snapshot.isUnlimited && (
              <div className="mt-3 rounded-md bg-red-500/10 p-2 text-red-700 dark:text-red-300">
                <p className="font-medium">当前额度：无限授权（uint256 最大值）</p>
                <p className="mt-1 break-all font-mono text-[10px]">原始额度：{snapshot.allowance.toString()}</p>
              </div>
            )}
            {snapshot.state === 'active' && !snapshot.isUnlimited && (
              <p className="mt-3 text-foreground">
                当前额度：{snapshot.formattedAllowance} {snapshot.target.asset.symbol}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
