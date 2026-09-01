'use client'

import { erc20Abi, zeroAddress, type Hash, type ReplacementReason } from 'viem'
import { useEffect, useMemo, useState } from 'react'
import {
  useConnection,
  useReadContracts,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { Button } from '../ui/button'
import { getTransactionExplorerUrl, WRITE_CHAIN } from '@/lib/chains'
import {
  getTrackedErc20ApprovalTarget,
  listTrackedErc20ApprovalTargets,
} from '@/lib/approvalRegistry'
import {
  resolveErc20ApprovalSnapshots,
  type ApprovalContractReadResult,
  type ApprovalInventoryReadState,
  type Erc20ApprovalSnapshot,
} from '@/lib/approvalInventory'
import {
  createApprovalRevokeReview,
  getApprovalRevokeErrorMessage,
  isApprovalRevokeReviewCurrent,
  type ApprovalRevokeReview,
} from '@/lib/approvalRevoke'
import { useWriteChainGuard } from '@/lib/hooks/useWriteChainGuard'
import {
  clearPendingApprovalRevoke,
  loadPendingApprovalRevoke,
  savePendingApprovalRevoke,
} from '@/lib/pendingApprovalRevokeStorage'
import { getReplacementMessage } from '@/lib/transactionState'

interface TrackedRevoke {
  readonly targetId: string
  readonly hash: Hash
  readonly contextKey: string
}

interface RevokeReplacement {
  readonly reason: ReplacementReason
  readonly hash: Hash
  readonly contextKey: string
}

interface RevokeOutcome {
  readonly status: 'success' | 'reverted'
  readonly hash: Hash
  readonly targetId: string
  readonly contextKey: string
}

export function ApprovalInventory() {
  const { address } = useConnection()
  const {
    chainId,
    isCorrectChain,
    switchToWriteChain,
    isSwitchingChain,
    switchChainError,
  } = useWriteChainGuard()
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
  const inventoryEvidenceKey = snapshots
    .map((snapshot) => `${snapshot.target.id}:${snapshot.state}:${snapshot.state === 'active' ? snapshot.allowance.toString() : ''}`)
    .join('|')
  const reviewContextKey = address && chainId ? `${chainId}:${address.toLowerCase()}` : null
  const revokeContextKey = address ? `${WRITE_CHAIN.id}:${address.toLowerCase()}:approval-revoke` : null
  const [revokeReview, setRevokeReview] = useState<ApprovalRevokeReview | null>(null)
  const reviewSnapshot = revokeReview
    ? snapshots.find((snapshot) => snapshot.target.id === revokeReview.targetId)
    : undefined
  const activeRevokeReview = revokeReview && isApprovalRevokeReviewCurrent(
    revokeReview,
    reviewSnapshot,
    address,
    chainId,
  ) ? revokeReview : null
  const {
    data: revokeSimulation,
    error: revokeSimulationError,
    isPending: isSimulatingRevoke,
  } = useSimulateContract({
    address: activeRevokeReview?.tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: activeRevokeReview ? [activeRevokeReview.spender, BigInt(0)] : undefined,
    account: activeRevokeReview?.account,
    chainId: WRITE_CHAIN.id,
    query: { enabled: Boolean(activeRevokeReview), retry: false },
  })
  const {
    mutate: writeContract,
    isPending: isAwaitingRevokeWallet,
    error: revokeWriteError,
    reset: resetRevokeWrite,
  } = useWriteContract()
  const [trackedRevoke, setTrackedRevoke] = useState<TrackedRevoke | null>(null)
  const [revokeReplacement, setRevokeReplacement] = useState<RevokeReplacement | null>(null)
  const [revokeOutcome, setRevokeOutcome] = useState<RevokeOutcome | null>(null)
  const revokeHash = trackedRevoke?.contextKey === revokeContextKey ? trackedRevoke.hash : undefined
  const {
    data: revokeReceipt,
    isLoading: isConfirmingRevoke,
    isSuccess: isRevokeReceiptResolved,
    error: revokeReceiptError,
    refetch: refetchRevokeReceipt,
    isRefetching: isRefetchingRevokeReceipt,
  } = useWaitForTransactionReceipt({
    chainId: WRITE_CHAIN.id,
    hash: revokeHash,
    onReplaced: ({ reason, transaction }) => {
      if (!address || !revokeContextKey || trackedRevoke?.contextKey !== revokeContextKey) return
      setRevokeReplacement({ reason, hash: transaction.hash, contextKey: revokeContextKey })
      if (reason === 'repriced') {
        savePendingApprovalRevoke(window.localStorage, {
          account: address,
          chainId: WRITE_CHAIN.id,
          targetId: trackedRevoke.targetId,
          hash: transaction.hash,
        })
        setTrackedRevoke({
          targetId: trackedRevoke.targetId,
          hash: transaction.hash,
          contextKey: revokeContextKey,
        })
      } else {
        clearPendingApprovalRevoke(window.localStorage, {
          account: address,
          chainId: WRITE_CHAIN.id,
        })
        setTrackedRevoke(null)
      }
    },
  })
  const visibleReplacement = revokeReplacement?.contextKey === revokeContextKey ? revokeReplacement : null
  const visibleOutcome = revokeOutcome?.contextKey === revokeContextKey ? revokeOutcome : null
  const outcomeSnapshot = visibleOutcome
    ? snapshots.find((snapshot) => snapshot.target.id === visibleOutcome.targetId)
    : undefined
  const revokeReplacementMessage = getReplacementMessage(visibleReplacement?.reason)
  const revokeWriteErrorMessage = getApprovalRevokeErrorMessage(revokeWriteError)
  const isRevokeLocked = isAwaitingRevokeWallet || Boolean(revokeHash)
  const revokeExplorerHash = visibleReplacement?.hash ?? revokeHash ?? visibleOutcome?.hash
  const revokeExplorerUrl = revokeExplorerHash
    ? getTransactionExplorerUrl(WRITE_CHAIN.id, revokeExplorerHash)
    : undefined

  useEffect(() => {
    if (!address || !revokeContextKey) return
    const record = loadPendingApprovalRevoke(window.localStorage, {
      account: address,
      chainId: WRITE_CHAIN.id,
    })
    const isKnownTarget = record
      ? Boolean(getTrackedErc20ApprovalTarget(record.chainId, record.targetId))
      : false
    if (record && !isKnownTarget) {
      clearPendingApprovalRevoke(window.localStorage, {
        account: address,
        chainId: WRITE_CHAIN.id,
      })
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setTrackedRevoke((current) => current?.contextKey === revokeContextKey
        ? current
        : record && isKnownTarget
          ? { targetId: record.targetId, hash: record.hash, contextKey: revokeContextKey }
          : null)
      setRevokeReplacement(null)
      setRevokeOutcome(null)
    })
    return () => { cancelled = true }
  }, [address, revokeContextKey])

  useEffect(() => {
    if (!revokeReview || activeRevokeReview) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setRevokeReview((current) => current === revokeReview ? null : current)
    })
    return () => { cancelled = true }
  }, [activeRevokeReview, inventoryEvidenceKey, reviewContextKey, revokeReview])

  useEffect(() => {
    if (!address || !revokeContextKey || !trackedRevoke || !revokeHash || !isRevokeReceiptResolved || !revokeReceipt) return
    clearPendingApprovalRevoke(window.localStorage, {
      account: address,
      chainId: WRITE_CHAIN.id,
    })
    const outcome: RevokeOutcome = {
      status: revokeReceipt.status === 'success' ? 'success' : 'reverted',
      hash: revokeHash,
      targetId: trackedRevoke.targetId,
      contextKey: revokeContextKey,
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setRevokeOutcome(outcome)
      setTrackedRevoke(null)
      if (outcome.status === 'success') void refetch()
    })
    return () => { cancelled = true }
  }, [address, isRevokeReceiptResolved, refetch, revokeContextKey, revokeHash, revokeReceipt, trackedRevoke])

  function openRevokeReview(snapshot: Erc20ApprovalSnapshot) {
    if (!address || !isCorrectChain || isRevokeLocked || snapshot.state !== 'active') return
    const review = createApprovalRevokeReview(snapshot, address, WRITE_CHAIN.name)
    if (!review) return
    resetRevokeWrite()
    setRevokeReplacement(null)
    setRevokeOutcome(null)
    setRevokeReview(review)
  }

  function confirmRevoke() {
    if (!address || !revokeContextKey || !activeRevokeReview || !isCorrectChain || isRevokeLocked || !revokeSimulation) return
    setRevokeReplacement(null)
    setRevokeOutcome(null)
    writeContract(revokeSimulation.request, {
      onSuccess: (hash) => {
        savePendingApprovalRevoke(window.localStorage, {
          account: address,
          chainId: WRITE_CHAIN.id,
          targetId: activeRevokeReview.targetId,
          hash,
        })
        setTrackedRevoke({
          targetId: activeRevokeReview.targetId,
          hash,
          contextKey: revokeContextKey,
        })
        setRevokeReview(null)
      },
    })
  }

  if (!address) {
    return <p className="text-sm text-muted-foreground">连接钱包后查看已登记范围内的授权</p>
  }

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
            {snapshot.state === 'active' && (
              <Button
                className="mt-3"
                variant="destructive"
                size="sm"
                onClick={() => openRevokeReview(snapshot)}
                disabled={!isCorrectChain || isRevokeLocked || isFetching}
              >
                准备撤销授权
              </Button>
            )}
          </article>
        ))}
      </div>

      {snapshots.some((snapshot) => snapshot.state === 'active') && !isCorrectChain && !isRevokeLocked && (
        <div className="space-y-2 rounded-md bg-orange-50 p-3 dark:bg-orange-950">
          <p className="text-sm text-orange-700 dark:text-orange-300">
            清单可以跨链读取；撤销交易必须由钱包在 {WRITE_CHAIN.name} 上签署。
          </p>
          <Button variant="outline" onClick={switchToWriteChain} disabled={isSwitchingChain}>
            {isSwitchingChain ? '切换中…' : `切换到 ${WRITE_CHAIN.name}`}
          </Button>
          {switchChainError && <p className="text-sm text-destructive">切换网络失败，请在钱包中重试。</p>}
        </div>
      )}

      {activeRevokeReview && (
        <div className="space-y-3 rounded-md border border-red-500/25 bg-red-500/5 p-3">
          <div>
            <p className="font-medium">撤销授权 Review</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              将调用 ERC-20 <span className="font-mono">approve(spender, 0)</span>。确认后仍需在钱包中核对并签名。
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">网络</dt><dd>{activeRevokeReview.chainName} ({activeRevokeReview.chainId})</dd>
            <dt className="text-muted-foreground">账户</dt><dd className="break-all font-mono">{activeRevokeReview.account}</dd>
            <dt className="text-muted-foreground">资产</dt><dd>{activeRevokeReview.tokenName} ({activeRevokeReview.symbol})</dd>
            <dt className="text-muted-foreground">Token</dt><dd className="break-all font-mono">{activeRevokeReview.tokenAddress}</dd>
            <dt className="text-muted-foreground">Spender</dt><dd className="break-all font-mono">{activeRevokeReview.spender}</dd>
            <dt className="text-muted-foreground">当前额度</dt>
            <dd>{activeRevokeReview.wasUnlimited ? '无限授权' : `${activeRevokeReview.formattedPreviousAllowance} ${activeRevokeReview.symbol}`}</dd>
            <dt className="text-muted-foreground">目标额度</dt><dd>0 {activeRevokeReview.symbol}</dd>
          </dl>
          {isSimulatingRevoke && <p className="text-sm text-muted-foreground">正在模拟撤销调用…</p>}
          {revokeSimulationError && (
            <p className="text-sm text-destructive">撤销模拟失败，未发送钱包请求。请刷新清单后重试。</p>
          )}
          {revokeSimulation && !revokeSimulationError && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">模拟通过：当前链上状态允许提交撤销调用。</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRevokeReview(null)} disabled={isAwaitingRevokeWallet}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRevoke}
              disabled={!revokeSimulation || Boolean(revokeSimulationError) || isSimulatingRevoke || isRevokeLocked}
            >
              {isAwaitingRevokeWallet ? '等待钱包确认…' : '确认并请求钱包'}
            </Button>
          </div>
        </div>
      )}

      {isAwaitingRevokeWallet && <p className="text-sm text-muted-foreground">等待钱包确认撤销交易…</p>}
      {revokeHash && isConfirmingRevoke && <p className="text-sm text-muted-foreground">撤销交易链上确认中…</p>}
      {revokeReceiptError && revokeHash && (
        <div className="space-y-2 rounded-md bg-orange-50 p-3 dark:bg-orange-950">
          <p className="text-sm text-orange-700 dark:text-orange-300">
            暂时无法确认撤销交易结果。Hash 已保留，不能再次提交同一撤销。
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetchRevokeReceipt()} disabled={isRefetchingRevokeReceipt}>
            {isRefetchingRevokeReceipt ? '重新查询中…' : '重新查询这笔撤销'}
          </Button>
        </div>
      )}
      {visibleOutcome?.status === 'success' && (isFetching || outcomeSnapshot?.state === 'loading') && (
        <p className="text-sm text-muted-foreground">撤销交易已确认，正在用链上 allowance 重新校验清单。</p>
      )}
      {visibleOutcome?.status === 'success' && outcomeSnapshot?.state === 'none' && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">撤销交易已确认；链上 allowance 已归零。</p>
      )}
      {visibleOutcome?.status === 'success' && outcomeSnapshot?.state === 'active' && !isFetching && (
        <p className="text-sm text-orange-700 dark:text-orange-300">
          撤销交易已确认，但最新 allowance 仍非零；可能存在并发授权或非标准代币行为，请以清单读数为准。
        </p>
      )}
      {visibleOutcome?.status === 'success' && outcomeSnapshot?.state === 'error' && (
        <p className="text-sm text-orange-700 dark:text-orange-300">撤销交易已确认，但暂时无法读取最新 allowance，结果仍需核验。</p>
      )}
      {visibleOutcome?.status === 'reverted' && (
        <p className="text-sm text-destructive">撤销交易已上链但执行失败，原授权可能仍然有效。</p>
      )}
      {revokeReplacementMessage && (
        <p className={visibleReplacement?.reason === 'repriced' ? 'text-sm text-muted-foreground' : 'text-sm text-orange-700 dark:text-orange-300'}>
          {revokeReplacementMessage}
        </p>
      )}
      {revokeWriteErrorMessage && <p className="text-sm text-destructive">{revokeWriteErrorMessage}</p>}
      {revokeExplorerUrl && revokeExplorerHash && (
        <a
          className="inline-flex text-xs text-emerald-700 underline underline-offset-4 dark:text-emerald-300"
          href={revokeExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={revokeExplorerHash}
        >
          在区块浏览器查看撤销交易
        </a>
      )}
    </div>
  )
}
