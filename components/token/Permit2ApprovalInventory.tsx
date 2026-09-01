'use client'

import { erc20Abi, keccak256, maxUint160, maxUint256, zeroAddress } from 'viem'
import { useMemo } from 'react'
import { useBlock, useBytecode, useConnection, useReadContracts } from 'wagmi'
import { Button } from '../ui/button'
import { WRITE_CHAIN } from '@/lib/chains'
import { permit2AllowanceAbi } from '@/lib/permit2'
import {
  formatPermit2Expiration,
  resolvePermit2AllowanceSnapshots,
  type Permit2InventoryReadState,
} from '@/lib/permit2Inventory'
import { listTrackedPermit2AllowanceTargets } from '@/lib/permit2Registry'
import type { ApprovalContractReadResult } from '@/lib/approvalInventory'

export function Permit2ApprovalInventory() {
  const { address } = useConnection()
  const targets = listTrackedPermit2AllowanceTargets(WRITE_CHAIN.id)
  const deployment = targets[0]
  const contracts = useMemo(() => targets.flatMap((target) => ([
    {
      address: target.asset.address,
      abi: erc20Abi,
      functionName: 'allowance' as const,
      args: [address ?? zeroAddress, target.permit2Address] as const,
      chainId: target.chainId,
    },
    {
      address: target.permit2Address,
      abi: permit2AllowanceAbi,
      functionName: 'allowance' as const,
      args: [address ?? zeroAddress, target.asset.address, target.spender] as const,
      chainId: target.chainId,
    },
  ])), [address, targets])
  const {
    data: reads,
    error: readsError,
    isPending: areReadsPending,
    isFetching: areReadsFetching,
    refetch: refetchReads,
  } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: Boolean(address) && contracts.length > 0 },
  })
  const {
    data: latestBlock,
    error: blockError,
    isPending: isBlockPending,
    isFetching: isBlockFetching,
    refetch: refetchBlock,
  } = useBlock({
    chainId: WRITE_CHAIN.id,
    watch: true,
    query: { enabled: Boolean(address) && targets.length > 0 },
  })
  const {
    data: permit2Bytecode,
    error: bytecodeError,
    isPending: isBytecodePending,
    isFetching: isBytecodeFetching,
    refetch: refetchBytecode,
  } = useBytecode({
    address: deployment?.permit2Address,
    chainId: WRITE_CHAIN.id,
    query: { enabled: Boolean(address) && Boolean(deployment) },
  })
  const runtimeCodeHash = permit2Bytecode && permit2Bytecode !== '0x'
    ? keccak256(permit2Bytecode)
    : undefined
  const isDeploymentVerified = Boolean(
    deployment
    && runtimeCodeHash
    && runtimeCodeHash === deployment.permit2RuntimeCodeHash,
  )
  const hasMissingResolvedData = Boolean(address) && (
    (!areReadsPending && !reads)
    || (!isBlockPending && !latestBlock)
    || (!isBytecodePending && (!permit2Bytecode || permit2Bytecode === '0x'))
  )

  let readState: Permit2InventoryReadState
  if (readsError || blockError || bytecodeError || hasMissingResolvedData || (runtimeCodeHash && !isDeploymentVerified)) {
    readState = { status: 'error' }
  } else if (areReadsPending || isBlockPending || isBytecodePending || !reads || !latestBlock || !runtimeCodeHash) {
    readState = { status: 'loading' }
  } else {
    readState = {
      status: 'success',
      results: reads as readonly ApprovalContractReadResult[],
      observedAt: latestBlock.timestamp,
    }
  }
  const snapshots = resolvePermit2AllowanceSnapshots(targets, readState)
  const isRefreshing = areReadsFetching || isBlockFetching || isBytecodeFetching

  function refresh() {
    void Promise.all([refetchReads(), refetchBlock(), refetchBytecode()])
  }

  if (!address) {
    return <p className="text-sm text-muted-foreground">连接钱包后查看已登记范围内的 Permit2 权限</p>
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Permit2 双层权限</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          实际可执行权限同时受 Token→Permit2 底层 allowance 和 Permit2→Spender 内部 allowance 限制。
        </p>
      </div>

      <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">
        <p>有限覆盖：只读取 Approval Registry 中登记的 owner / token / spender 组合。</p>
        <p>Permit2 SignatureTransfer 的未使用签名保存在链下，无法通过 allowance 清单枚举；这里不宣称扫描了签名风险。</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Canonical Permit2 <span className="break-all font-mono text-foreground">{deployment?.permit2Address}</span>
        </p>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          {isRefreshing ? '读取中…' : '刷新 Permit2 清单'}
        </Button>
      </div>

      {isDeploymentVerified && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Sepolia runtime code hash 已匹配 Registry：<span className="break-all font-mono">{runtimeCodeHash}</span>
        </p>
      )}

      {snapshots.map((snapshot) => (
        <article key={snapshot.target.id} className="rounded-md border border-foreground/10 p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{snapshot.target.asset.name} ({snapshot.target.asset.symbol})</p>
              <p className="mt-1 text-xs text-muted-foreground">{snapshot.target.spenderLabel}</p>
            </div>
            <span className="rounded-full bg-foreground/5 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">
              Permit2
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Token</dt><dd className="break-all font-mono">{snapshot.target.asset.address}</dd>
            <dt className="text-muted-foreground">Spender</dt><dd className="break-all font-mono">{snapshot.target.spender}</dd>
            {'amount' in snapshot && (
              <>
                <dt className="text-muted-foreground">Token→Permit2</dt>
                <dd>{snapshot.isTokenAllowanceUnlimited ? '无限（uint256 最大值）' : `${snapshot.formattedTokenAllowanceToPermit2} ${snapshot.target.asset.symbol}`}</dd>
                <dt className="text-muted-foreground">Permit2→Spender</dt>
                <dd>{snapshot.isPermit2AmountUnlimited ? '无限（uint160 最大值）' : `${snapshot.formattedAmount} ${snapshot.target.asset.symbol}`}</dd>
                <dt className="text-muted-foreground">到期时间</dt><dd>{formatPermit2Expiration(snapshot.expiration)}</dd>
                <dt className="text-muted-foreground">Nonce</dt><dd className="font-mono">{snapshot.nonce.toString()}</dd>
              </>
            )}
          </dl>

          {snapshot.state === 'loading' && <p className="mt-3 text-muted-foreground">Permit2 权限读取中…</p>}
          {snapshot.state === 'error' && (
            <p className="mt-3 text-destructive">Permit2 合约身份或权限读取失败；结果未知，不能当作无授权。</p>
          )}
          {snapshot.state === 'none' && (
            <p className="mt-3 text-muted-foreground">该 Spender 的 Permit2 存储额度为 0。</p>
          )}
          {snapshot.state === 'expired' && (
            <p className="mt-3 text-orange-700 dark:text-orange-300">Permit2 内部额度已过期，当前不能执行，但历史存储值仍保留。</p>
          )}
          {snapshot.state === 'dormant' && (
            <p className="mt-3 text-orange-700 dark:text-orange-300">
              Permit2 内部额度仍未过期，但 Token→Permit2 底层额度为 0；当前不可执行，底层额度恢复后可能重新生效。
            </p>
          )}
          {snapshot.state === 'active' && (
            <div className="mt-3 rounded-md bg-red-500/10 p-2 text-red-700 dark:text-red-300">
              <p className="font-medium">
                有效可执行额度：{snapshot.isPermit2AmountUnlimited && snapshot.effectiveAmount === maxUint160
                  ? '无限'
                  : `${snapshot.formattedEffectiveAmount} ${snapshot.target.asset.symbol}`}
              </p>
              <p className="mt-1 text-xs">有效额度取两层 allowance 的较小值，不代表账户当前余额。</p>
            </div>
          )}
        </article>
      ))}

      {snapshots.some((snapshot) => 'tokenAllowanceToPermit2' in snapshot
        && snapshot.tokenAllowanceToPermit2 === maxUint256) && (
        <p className="text-xs text-orange-700 dark:text-orange-300">
          注意：Token 对 Permit2 的 uint256 最大额度是独立的底层授权，即使当前 Spender 内部额度为 0 也仍存在。
        </p>
      )}
    </div>
  )
}
