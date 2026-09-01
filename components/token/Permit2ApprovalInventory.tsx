'use client'

import {
  erc20Abi,
  keccak256,
  maxUint160,
  maxUint256,
  zeroAddress,
  type Hash,
  type ReplacementReason,
} from 'viem'
import { useEffect, useMemo, useState } from 'react'
import {
  useBlock,
  useBytecode,
  useConnection,
  useReadContracts,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { Button } from '../ui/button'
import { getTransactionExplorerUrl, WRITE_CHAIN } from '@/lib/chains'
import { permit2AllowanceAbi } from '@/lib/permit2'
import {
  formatPermit2Expiration,
  resolvePermit2AllowanceSnapshots,
  type Permit2AllowanceSnapshot,
  type Permit2InventoryReadState,
} from '@/lib/permit2Inventory'
import {
  getTrackedPermit2AllowanceTarget,
  listTrackedPermit2AllowanceTargets,
} from '@/lib/permit2Registry'
import {
  createPermit2LockdownReview,
  getPermit2LockdownErrorMessage,
  isPermit2LockdownReviewCurrent,
  type Permit2LockdownReview,
} from '@/lib/permit2Lockdown'
import {
  clearPendingPermit2Lockdown,
  loadPendingPermit2Lockdown,
  savePendingPermit2Lockdown,
} from '@/lib/pendingPermit2LockdownStorage'
import { useWriteChainGuard } from '@/lib/hooks/useWriteChainGuard'
import { getReplacementMessage } from '@/lib/transactionState'
import type { ApprovalContractReadResult } from '@/lib/approvalInventory'

interface TrackedLockdown {
  readonly targetId: string
  readonly hash: Hash
  readonly contextKey: string
}

interface LockdownReplacement {
  readonly reason: ReplacementReason
  readonly hash: Hash
  readonly contextKey: string
}

interface LockdownOutcome {
  readonly status: 'success' | 'reverted'
  readonly hash: Hash
  readonly targetId: string
  readonly contextKey: string
}

function isPermit2PermissionStored(snapshot: Permit2AllowanceSnapshot): boolean {
  return (snapshot.state === 'active' || snapshot.state === 'expired' || snapshot.state === 'dormant')
    && snapshot.amount > BigInt(0)
}

export function Permit2ApprovalInventory() {
  const { address } = useConnection()
  const {
    chainId,
    isCorrectChain,
    switchToWriteChain,
    isSwitchingChain,
    switchChainError,
  } = useWriteChainGuard()
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
  const inventoryEvidenceKey = snapshots.map((snapshot) => {
    if (!('amount' in snapshot)) return `${snapshot.target.id}:${snapshot.state}`
    return [
      snapshot.target.id,
      snapshot.state,
      snapshot.tokenAllowanceToPermit2.toString(),
      snapshot.amount.toString(),
      snapshot.expiration.toString(),
      snapshot.nonce.toString(),
    ].join(':')
  }).join('|')
  const isRefreshing = areReadsFetching || isBlockFetching || isBytecodeFetching
  const reviewContextKey = address && chainId ? `${chainId}:${address.toLowerCase()}` : null
  const lockdownContextKey = address ? `${WRITE_CHAIN.id}:${address.toLowerCase()}:permit2-lockdown` : null
  const [lockdownReview, setLockdownReview] = useState<Permit2LockdownReview | null>(null)
  const reviewSnapshot = lockdownReview
    ? snapshots.find((snapshot) => snapshot.target.id === lockdownReview.targetId)
    : undefined
  const activeLockdownReview = lockdownReview && isPermit2LockdownReviewCurrent(
    lockdownReview,
    reviewSnapshot,
    address,
    chainId,
  ) ? lockdownReview : null
  const {
    data: lockdownSimulation,
    error: lockdownSimulationError,
    isPending: isSimulatingLockdown,
  } = useSimulateContract({
    address: activeLockdownReview?.permit2Address,
    abi: permit2AllowanceAbi,
    functionName: 'lockdown',
    args: activeLockdownReview
      ? [[{ token: activeLockdownReview.tokenAddress, spender: activeLockdownReview.spender }]]
      : undefined,
    account: activeLockdownReview?.account,
    chainId: WRITE_CHAIN.id,
    query: { enabled: Boolean(activeLockdownReview), retry: false },
  })
  const {
    mutate: writeContract,
    isPending: isAwaitingLockdownWallet,
    error: lockdownWriteError,
    reset: resetLockdownWrite,
  } = useWriteContract()
  const [trackedLockdown, setTrackedLockdown] = useState<TrackedLockdown | null>(null)
  const [lockdownReplacement, setLockdownReplacement] = useState<LockdownReplacement | null>(null)
  const [lockdownOutcome, setLockdownOutcome] = useState<LockdownOutcome | null>(null)
  const lockdownHash = trackedLockdown?.contextKey === lockdownContextKey
    ? trackedLockdown.hash
    : undefined
  const {
    data: lockdownReceipt,
    isLoading: isConfirmingLockdown,
    isSuccess: isLockdownReceiptResolved,
    error: lockdownReceiptError,
    refetch: refetchLockdownReceipt,
    isRefetching: isRefetchingLockdownReceipt,
  } = useWaitForTransactionReceipt({
    chainId: WRITE_CHAIN.id,
    hash: lockdownHash,
    onReplaced: ({ reason, transaction }) => {
      if (!address || !lockdownContextKey || trackedLockdown?.contextKey !== lockdownContextKey) return
      setLockdownReplacement({ reason, hash: transaction.hash, contextKey: lockdownContextKey })
      if (reason === 'repriced') {
        savePendingPermit2Lockdown(window.localStorage, {
          account: address,
          chainId: WRITE_CHAIN.id,
          targetId: trackedLockdown.targetId,
          hash: transaction.hash,
        })
        setTrackedLockdown({
          targetId: trackedLockdown.targetId,
          hash: transaction.hash,
          contextKey: lockdownContextKey,
        })
      } else {
        clearPendingPermit2Lockdown(window.localStorage, {
          account: address,
          chainId: WRITE_CHAIN.id,
        })
        setTrackedLockdown(null)
      }
    },
  })
  const visibleReplacement = lockdownReplacement?.contextKey === lockdownContextKey
    ? lockdownReplacement
    : null
  const visibleOutcome = lockdownOutcome?.contextKey === lockdownContextKey
    ? lockdownOutcome
    : null
  const outcomeSnapshot = visibleOutcome
    ? snapshots.find((snapshot) => snapshot.target.id === visibleOutcome.targetId)
    : undefined
  const lockdownReplacementMessage = getReplacementMessage(visibleReplacement?.reason)
  const lockdownWriteErrorMessage = getPermit2LockdownErrorMessage(lockdownWriteError)
  const isLockdownLocked = isAwaitingLockdownWallet || Boolean(lockdownHash)
  const lockdownExplorerHash = visibleReplacement?.hash ?? lockdownHash ?? visibleOutcome?.hash
  const lockdownExplorerUrl = lockdownExplorerHash
    ? getTransactionExplorerUrl(WRITE_CHAIN.id, lockdownExplorerHash)
    : undefined

  useEffect(() => {
    if (!address || !lockdownContextKey) return
    const record = loadPendingPermit2Lockdown(window.localStorage, {
      account: address,
      chainId: WRITE_CHAIN.id,
    })
    const isKnownTarget = record
      ? Boolean(getTrackedPermit2AllowanceTarget(record.chainId, record.targetId))
      : false
    if (record && !isKnownTarget) {
      clearPendingPermit2Lockdown(window.localStorage, {
        account: address,
        chainId: WRITE_CHAIN.id,
      })
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setTrackedLockdown((current) => current?.contextKey === lockdownContextKey
        ? current
        : record && isKnownTarget
          ? { targetId: record.targetId, hash: record.hash, contextKey: lockdownContextKey }
          : null)
      setLockdownReplacement(null)
      setLockdownOutcome(null)
    })
    return () => { cancelled = true }
  }, [address, lockdownContextKey])

  useEffect(() => {
    if (!lockdownReview || activeLockdownReview) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLockdownReview((current) => current === lockdownReview ? null : current)
    })
    return () => { cancelled = true }
  }, [activeLockdownReview, inventoryEvidenceKey, lockdownReview, reviewContextKey])

  useEffect(() => {
    if (!address || !lockdownContextKey || !trackedLockdown || !lockdownHash
      || !isLockdownReceiptResolved || !lockdownReceipt) return
    clearPendingPermit2Lockdown(window.localStorage, {
      account: address,
      chainId: WRITE_CHAIN.id,
    })
    const outcome: LockdownOutcome = {
      status: lockdownReceipt.status === 'success' ? 'success' : 'reverted',
      hash: lockdownHash,
      targetId: trackedLockdown.targetId,
      contextKey: lockdownContextKey,
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLockdownOutcome(outcome)
      setTrackedLockdown(null)
      if (outcome.status === 'success') {
        void Promise.all([refetchReads(), refetchBlock(), refetchBytecode()])
      }
    })
    return () => { cancelled = true }
  }, [
    address,
    isLockdownReceiptResolved,
    lockdownContextKey,
    lockdownHash,
    lockdownReceipt,
    refetchBlock,
    refetchBytecode,
    refetchReads,
    trackedLockdown,
  ])

  function refresh() {
    void Promise.all([refetchReads(), refetchBlock(), refetchBytecode()])
  }

  function openLockdownReview(snapshot: Permit2AllowanceSnapshot) {
    if (!address || !isCorrectChain || isLockdownLocked || !isPermit2PermissionStored(snapshot)) return
    const review = createPermit2LockdownReview(snapshot, address, WRITE_CHAIN.name)
    if (!review) return
    resetLockdownWrite()
    setLockdownReplacement(null)
    setLockdownOutcome(null)
    setLockdownReview(review)
  }

  function confirmLockdown() {
    if (!address || !lockdownContextKey || !activeLockdownReview || !isCorrectChain
      || isLockdownLocked || !lockdownSimulation) return
    setLockdownReplacement(null)
    setLockdownOutcome(null)
    writeContract(lockdownSimulation.request, {
      onSuccess: (hash) => {
        savePendingPermit2Lockdown(window.localStorage, {
          account: address,
          chainId: WRITE_CHAIN.id,
          targetId: activeLockdownReview.targetId,
          hash,
        })
        setTrackedLockdown({
          targetId: activeLockdownReview.targetId,
          hash,
          contextKey: lockdownContextKey,
        })
        setLockdownReview(null)
      },
    })
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
          {isPermit2PermissionStored(snapshot) && (
            <Button
              className="mt-3"
              variant="destructive"
              size="sm"
              onClick={() => openLockdownReview(snapshot)}
              disabled={!isCorrectChain || isLockdownLocked || isRefreshing}
            >
              准备清除 Permit2 内部授权
            </Button>
          )}
        </article>
      ))}

      {snapshots.some(isPermit2PermissionStored) && !isCorrectChain && !isLockdownLocked && (
        <div className="space-y-2 rounded-md bg-orange-50 p-3 dark:bg-orange-950">
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Permit2 清单可以跨链读取；lockdown 交易必须由钱包在 {WRITE_CHAIN.name} 上签署。
          </p>
          <Button variant="outline" onClick={switchToWriteChain} disabled={isSwitchingChain}>
            {isSwitchingChain ? '切换中…' : `切换到 ${WRITE_CHAIN.name}`}
          </Button>
          {switchChainError && <p className="text-sm text-destructive">切换网络失败，请在钱包中重试。</p>}
        </div>
      )}

      {activeLockdownReview && (
        <div className="space-y-3 rounded-md border border-red-500/25 bg-red-500/5 p-3">
          <div>
            <p className="font-medium">Permit2 lockdown Review</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              将对本次选中的 1 个 token / spender 调用 <span className="font-mono">lockdown</span>，把 Permit2 内部 amount 清零。
              这不会清除 Token→Permit2 的底层 ERC-20 allowance。
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">网络</dt><dd>{activeLockdownReview.chainName} ({activeLockdownReview.chainId})</dd>
            <dt className="text-muted-foreground">账户</dt><dd className="break-all font-mono">{activeLockdownReview.account}</dd>
            <dt className="text-muted-foreground">Permit2</dt><dd className="break-all font-mono">{activeLockdownReview.permit2Address}</dd>
            <dt className="text-muted-foreground">资产</dt><dd>{activeLockdownReview.tokenName} ({activeLockdownReview.symbol})</dd>
            <dt className="text-muted-foreground">Token</dt><dd className="break-all font-mono">{activeLockdownReview.tokenAddress}</dd>
            <dt className="text-muted-foreground">Spender</dt><dd className="break-all font-mono">{activeLockdownReview.spender}</dd>
            <dt className="text-muted-foreground">当前状态</dt><dd>{activeLockdownReview.previousState}</dd>
            <dt className="text-muted-foreground">内部额度</dt><dd>{activeLockdownReview.formattedPreviousAmount} {activeLockdownReview.symbol}</dd>
            <dt className="text-muted-foreground">到期时间</dt><dd>{formatPermit2Expiration(activeLockdownReview.previousExpiration)}</dd>
            <dt className="text-muted-foreground">Nonce</dt><dd className="font-mono">{activeLockdownReview.previousNonce.toString()}</dd>
            <dt className="text-muted-foreground">目标额度</dt><dd>0 {activeLockdownReview.symbol}</dd>
          </dl>
          {isSimulatingLockdown && <p className="text-sm text-muted-foreground">正在模拟 Permit2 lockdown…</p>}
          {lockdownSimulationError && (
            <p className="text-sm text-destructive">lockdown 模拟失败，未发送钱包请求。请刷新清单后重试。</p>
          )}
          {lockdownSimulation && !lockdownSimulationError && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">模拟通过：当前链上状态允许提交 lockdown。</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLockdownReview(null)} disabled={isAwaitingLockdownWallet}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLockdown}
              disabled={!lockdownSimulation || Boolean(lockdownSimulationError) || isSimulatingLockdown || isLockdownLocked}
            >
              {isAwaitingLockdownWallet ? '等待钱包确认…' : '确认并请求钱包'}
            </Button>
          </div>
        </div>
      )}

      {isAwaitingLockdownWallet && <p className="text-sm text-muted-foreground">等待钱包确认 Permit2 撤销交易…</p>}
      {lockdownHash && isConfirmingLockdown && <p className="text-sm text-muted-foreground">Permit2 撤销交易链上确认中…</p>}
      {lockdownReceiptError && lockdownHash && (
        <div className="space-y-2 rounded-md bg-orange-50 p-3 dark:bg-orange-950">
          <p className="text-sm text-orange-700 dark:text-orange-300">
            暂时无法确认 Permit2 撤销结果。Hash 已保留，不能再次提交同一 lockdown。
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchLockdownReceipt()}
            disabled={isRefetchingLockdownReceipt}
          >
            {isRefetchingLockdownReceipt ? '重新查询中…' : '重新查询这笔 Permit2 撤销'}
          </Button>
        </div>
      )}
      {visibleOutcome?.status === 'success' && (isRefreshing || outcomeSnapshot?.state === 'loading') && (
        <p className="text-sm text-muted-foreground">lockdown 已确认，正在重新校验 Permit2 双层权限。</p>
      )}
      {visibleOutcome?.status === 'success' && outcomeSnapshot?.state === 'none' && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          lockdown 已确认；Permit2 内部 amount 已归零。Token→Permit2 底层 allowance 未被本操作修改。
        </p>
      )}
      {visibleOutcome?.status === 'success' && outcomeSnapshot && isPermit2PermissionStored(outcomeSnapshot) && !isRefreshing && (
        <p className="text-sm text-orange-700 dark:text-orange-300">
          lockdown 已确认，但最新 Permit2 内部 amount 仍非零；可能存在并发授权，请以清单读数为准。
        </p>
      )}
      {visibleOutcome?.status === 'success' && outcomeSnapshot?.state === 'error' && (
        <p className="text-sm text-orange-700 dark:text-orange-300">
          lockdown 已确认，但暂时无法读取最新 Permit2 权限，结果仍需核验。
        </p>
      )}
      {visibleOutcome?.status === 'reverted' && (
        <p className="text-sm text-destructive">Permit2 撤销交易已上链但执行失败，内部授权可能仍然有效。</p>
      )}
      {lockdownReplacementMessage && (
        <p className={visibleReplacement?.reason === 'repriced' ? 'text-sm text-muted-foreground' : 'text-sm text-orange-700 dark:text-orange-300'}>
          {lockdownReplacementMessage}
        </p>
      )}
      {lockdownWriteErrorMessage && <p className="text-sm text-destructive">{lockdownWriteErrorMessage}</p>}
      {lockdownExplorerUrl && lockdownExplorerHash && (
        <a
          className="inline-flex text-xs text-emerald-700 underline underline-offset-4 dark:text-emerald-300"
          href={lockdownExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={lockdownExplorerHash}
        >
          在区块浏览器查看 Permit2 撤销交易
        </a>
      )}

      {snapshots.some((snapshot) => 'tokenAllowanceToPermit2' in snapshot
        && snapshot.tokenAllowanceToPermit2 === maxUint256) && (
        <p className="text-xs text-orange-700 dark:text-orange-300">
          注意：Token 对 Permit2 的 uint256 最大额度是独立的底层授权，即使当前 Spender 内部额度为 0 也仍存在。
        </p>
      )}
    </div>
  )
}
