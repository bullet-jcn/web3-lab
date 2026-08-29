'use client'

import { useEffect, useState } from 'react'
import { erc20Abi } from 'viem'
import { useCapabilities, useConnection, usePublicClient, useSendCalls, useWaitForCallsStatus, useWriteContract } from 'wagmi'
import { DEMO_ERC20_ADDRESS, DEMO_RECIPIENT_A, DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT } from '@/lib/constants'
import { resolveAtomicBatchState, resolveAtomicSupport } from '@/lib/eip5792'
import { Button } from '@/components/ui/button'
import { useWriteChainGuard } from '@/lib/hooks/useWriteChainGuard'
import { getErrorMessage } from '@/lib/errors'
import { clearPendingBatch, loadPendingBatch, savePendingBatch, type PendingSequentialBatchRecord } from '@/lib/pendingBatchStorage'

type SequentialStep =
  | 'idle'
  | 'awaiting-first-wallet'
  | 'confirming-first'
  | 'awaiting-second-wallet'
  | 'confirming-second'
  | 'done'
  | 'partial-success'
  | 'recovery-error'
  | 'error'

interface TrackedSequentialBatch {
  record: PendingSequentialBatchRecord
  contextKey: string
  shouldRecover: boolean
}

export function BatchedTransferDemo() {
  const { address } = useConnection()
  const { chainId, writeChain, isCorrectChain, switchToWriteChain, isSwitchingChain, switchChainError } = useWriteChainGuard()
  const publicClient = usePublicClient({ chainId: writeChain.id })
  const waitForTransactionReceipt = publicClient?.waitForTransactionReceipt
  const atomicContextKey = address && chainId ? `${chainId}:${address.toLowerCase()}:atomic` : null
  const sequentialContextKey = address && chainId ? `${chainId}:${address.toLowerCase()}:sequential` : null

  const { data: capabilities, isLoading: isCapabilitiesLoading } = useCapabilities({ chainId: writeChain.id })
  const support = resolveAtomicSupport(capabilities?.atomic?.status)

  const { mutate: sendCalls, isPending: isSendingBatch, error: sendCallsError } = useSendCalls()
  const [trackedAtomicBatch, setTrackedAtomicBatch] = useState<{ id: string; contextKey: string } | null>(null)
  const atomicBatchId = trackedAtomicBatch?.contextKey === atomicContextKey ? trackedAtomicBatch.id : undefined
  const { data: callsStatus, error: callsStatusError } = useWaitForCallsStatus({ id: atomicBatchId })
  const atomicBatchError = sendCallsError ?? callsStatusError
  const atomicBatchState = resolveAtomicBatchState({
    isAwaitingWallet: isSendingBatch,
    bundleId: atomicBatchId,
    status: callsStatus?.status,
    receiptStatuses: callsStatus?.receipts?.map((receipt) => receipt.status) ?? [],
    error: atomicBatchError,
  })
  const atomicBatchErrorMessage = getErrorMessage(atomicBatchError)
  const hasRevertedAtomicReceipt = callsStatus?.receipts?.some((receipt) => receipt.status === 'reverted') ?? false
  const isAtomicBatchUnresolved = !!atomicBatchId
    && callsStatus?.status !== 'success'
    && callsStatus?.status !== 'failure'
    && !hasRevertedAtomicReceipt

  useEffect(() => {
    if (!address || !chainId || !atomicContextKey) return
    const record = loadPendingBatch(window.localStorage, { account: address, chainId, mode: 'atomic' })
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setTrackedAtomicBatch((current) => current?.contextKey === atomicContextKey
        ? current
        : record?.mode === 'atomic' ? { id: record.id, contextKey: atomicContextKey } : null)
    })
    return () => { cancelled = true }
  }, [address, atomicContextKey, chainId])

  useEffect(() => {
    if (!address || !chainId || !atomicBatchId) return
    if (callsStatus?.status !== 'success' && callsStatus?.status !== 'failure' && !hasRevertedAtomicReceipt) return
    clearPendingBatch(window.localStorage, { account: address, chainId, mode: 'atomic' })
  }, [address, atomicBatchId, callsStatus?.status, chainId, hasRevertedAtomicReceipt])

  const { mutateAsync: writeContractAsync } = useWriteContract()
  const [sequentialStep, setSequentialStep] = useState<SequentialStep>('idle')
  const [sequentialError, setSequentialError] = useState<string | null>(null)
  const [trackedSequentialBatch, setTrackedSequentialBatch] = useState<TrackedSequentialBatch | null>(null)
  const activeSequentialBatch = trackedSequentialBatch?.contextKey === sequentialContextKey
    ? trackedSequentialBatch
    : null

  useEffect(() => {
    if (!address || !chainId || !sequentialContextKey) return
    const record = loadPendingBatch(window.localStorage, { account: address, chainId, mode: 'sequential' })
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setTrackedSequentialBatch((current) => current?.contextKey === sequentialContextKey
        ? current
        : record?.mode === 'sequential'
          ? { record, contextKey: sequentialContextKey, shouldRecover: true }
          : null)
      setSequentialError(null)
    })
    return () => { cancelled = true }
  }, [address, chainId, sequentialContextKey])

  useEffect(() => {
    if (!activeSequentialBatch?.shouldRecover || !address || !chainId || !waitForTransactionReceipt) return
    const batch = activeSequentialBatch
    const recoveryAddress = address
    const recoveryChainId = chainId
    const waitForRecoveryReceipt = waitForTransactionReceipt
    let cancelled = false

    async function recoverSequentialBatch() {
      const { record } = batch
      setSequentialError(null)

      if (record.stage === 'first-confirmed') {
        setSequentialStep('partial-success')
        return
      }

      try {
        const isFirstPending = record.stage === 'first-pending'
        setSequentialStep(isFirstPending ? 'confirming-first' : 'confirming-second')
        const hash = record.stage === 'first-pending' ? record.firstHash : record.secondHash!
        const receipt = await waitForRecoveryReceipt({ hash })
        if (cancelled) return

        if (receipt.status !== 'success') {
          clearPendingBatch(window.localStorage, { account: recoveryAddress, chainId: recoveryChainId, mode: 'sequential' })
          setTrackedSequentialBatch(null)
          setSequentialStep(isFirstPending ? 'error' : 'partial-success')
          setSequentialError(`execution reverted: ${isFirstPending ? 'first' : 'second'} transfer`)
          return
        }

        if (isFirstPending) {
          const nextRecord = savePendingBatch(window.localStorage, {
            account: recoveryAddress,
            chainId: recoveryChainId,
            mode: 'sequential',
            stage: 'first-confirmed',
            firstHash: record.firstHash,
          }) as PendingSequentialBatchRecord
          setTrackedSequentialBatch({ record: nextRecord, contextKey: batch.contextKey, shouldRecover: true })
          setSequentialStep('partial-success')
          return
        }

        clearPendingBatch(window.localStorage, { account: recoveryAddress, chainId: recoveryChainId, mode: 'sequential' })
        setTrackedSequentialBatch(null)
        setSequentialStep('done')
      } catch (err) {
        if (cancelled) return
        setSequentialStep('recovery-error')
        setSequentialError(err instanceof Error ? err.message : '批次状态查询失败')
      }
    }

    void recoverSequentialBatch()
    return () => { cancelled = true }
  }, [activeSequentialBatch, address, chainId, waitForTransactionReceipt])

  function handleAtomicTransfer() {
    if (!address || !isCorrectChain) return
    sendCalls({
      calls: [
        { to: DEMO_ERC20_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [DEMO_RECIPIENT_A, DEMO_TRANSFER_AMOUNT] },
        { to: DEMO_ERC20_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT] },
      ],
      forceAtomic: true,
    }, {
      onSuccess: ({ id }) => {
        if (!atomicContextKey || !chainId) return
        savePendingBatch(window.localStorage, { account: address, chainId, mode: 'atomic', id })
        setTrackedAtomicBatch({ id, contextKey: atomicContextKey })
      },
    })
  }

  async function handleSequentialTransfer() {
    if (!address || !chainId || !sequentialContextKey || !isCorrectChain || !publicClient || activeSequentialBatch) return
    setSequentialError(null)
    setSequentialStep('awaiting-first-wallet')
    let firstTransferConfirmed = false

    try {
      const firstHash = await writeContractAsync({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [DEMO_RECIPIENT_A, DEMO_TRANSFER_AMOUNT],
      })
      const firstPending = savePendingBatch(window.localStorage, {
        account: address,
        chainId,
        mode: 'sequential',
        stage: 'first-pending',
        firstHash,
      }) as PendingSequentialBatchRecord
      setTrackedSequentialBatch({ record: firstPending, contextKey: sequentialContextKey, shouldRecover: false })
      setSequentialStep('confirming-first')
      const firstReceipt = await publicClient.waitForTransactionReceipt({ hash: firstHash })
      if (firstReceipt.status !== 'success') {
        clearPendingBatch(window.localStorage, { account: address, chainId, mode: 'sequential' })
        setTrackedSequentialBatch(null)
        throw new Error('execution reverted: first transfer')
      }
      firstTransferConfirmed = true
      const firstConfirmed = savePendingBatch(window.localStorage, {
        account: address,
        chainId,
        mode: 'sequential',
        stage: 'first-confirmed',
        firstHash,
      }) as PendingSequentialBatchRecord
      setTrackedSequentialBatch({ record: firstConfirmed, contextKey: sequentialContextKey, shouldRecover: false })

      setSequentialStep('awaiting-second-wallet')
      const secondHash = await writeContractAsync({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT],
      })
      const secondPending = savePendingBatch(window.localStorage, {
        account: address,
        chainId,
        mode: 'sequential',
        stage: 'second-pending',
        firstHash,
        secondHash,
      }) as PendingSequentialBatchRecord
      setTrackedSequentialBatch({ record: secondPending, contextKey: sequentialContextKey, shouldRecover: false })
      setSequentialStep('confirming-second')
      const secondReceipt = await publicClient.waitForTransactionReceipt({ hash: secondHash })
      clearPendingBatch(window.localStorage, { account: address, chainId, mode: 'sequential' })
      setTrackedSequentialBatch(null)
      if (secondReceipt.status !== 'success') throw new Error('execution reverted: second transfer')
      setSequentialStep('done')
    } catch (err) {
      const pendingRecord = loadPendingBatch(window.localStorage, { account: address, chainId, mode: 'sequential' })
      if (pendingRecord?.mode === 'sequential') {
        setTrackedSequentialBatch({ record: pendingRecord, contextKey: sequentialContextKey, shouldRecover: false })
      }
      const hasUnresolvedReceipt = pendingRecord?.mode === 'sequential'
        && (pendingRecord.stage === 'first-pending' || pendingRecord.stage === 'second-pending')
      setSequentialStep(hasUnresolvedReceipt ? 'recovery-error' : firstTransferConfirmed ? 'partial-success' : 'error')
      setSequentialError(err instanceof Error ? err.message : '转账失败')
    }
  }

  if (!address) {
    return <p className="text-sm text-muted-foreground">连接钱包后可以使用批量转账</p>
  }

  if (!isCorrectChain) {
    return (
      <div className="space-y-2 rounded-md bg-orange-50 p-3 dark:bg-orange-950">
        <p className="text-sm text-orange-600 dark:text-orange-400">
          批量调用配置属于 {writeChain.name}，请先切换网络后再检测和提交。
        </p>
        <Button
          variant="outline"
          onClick={switchToWriteChain}
          disabled={isSwitchingChain}
        >
          {isSwitchingChain ? '切换中…' : `切换到 ${writeChain.name}`}
        </Button>
        {switchChainError && <p className="text-sm text-destructive">切换网络失败: {switchChainError.message}</p>}
      </div>
    )
  }

  if (isCapabilitiesLoading) {
    return <p className="text-sm text-muted-foreground">检测钱包能力中…</p>
  }

  const isSendingSequential = [
    'awaiting-first-wallet',
    'confirming-first',
    'awaiting-second-wallet',
    'confirming-second',
  ].includes(sequentialStep)
  const isSequentialLocked = isSendingSequential
    || !!activeSequentialBatch
    || sequentialStep === 'partial-success'

  if (!!atomicBatchId || (!activeSequentialBatch && support !== 'sequential-fallback')) {
    const isAtomicBatchBusy = atomicBatchState === 'awaiting-wallet'
      || atomicBatchState === 'confirming'
      || isAtomicBatchUnresolved

    return (
      <div className="space-y-2">
        <Button className="w-full" onClick={handleAtomicTransfer} disabled={isAtomicBatchBusy}>
          {atomicBatchState === 'awaiting-wallet' && '等待钱包确认批量交易…'}
          {atomicBatchState === 'confirming' && '批量交易链上确认中…'}
          {atomicBatchState === 'failure' && isAtomicBatchUnresolved && '批量状态暂时无法确认'}
          {!isAtomicBatchBusy && '批量转账(原子)'}
        </Button>
        {support === 'upgrade-then-atomic' && (
          <p className="text-sm text-gray-500 dark:text-neutral-400">首次使用可能需要先确认一次账户升级</p>
        )}
        {atomicBatchState === 'success' && <p className="text-sm text-emerald-300">原子批量交易已确认</p>}
        {atomicBatchState === 'failure' && (
          <p className="text-sm text-destructive">
            {atomicBatchErrorMessage ?? '原子批量交易失败，没有任何一笔应被视为成功。'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="rounded-md bg-orange-50 p-2 text-sm text-orange-600 dark:bg-orange-950 dark:text-orange-400">
        当前钱包不支持原子批量转账,这两笔转账会分开发送——如果第二笔失败,第一笔不会被撤销。
      </p>
      <Button className="w-full" onClick={handleSequentialTransfer} disabled={!publicClient || isSequentialLocked}>
        {sequentialStep === 'awaiting-first-wallet' && '等待确认第一笔…'}
        {sequentialStep === 'confirming-first' && '链上确认第一笔…'}
        {sequentialStep === 'awaiting-second-wallet' && '第一笔已确认，等待确认第二笔…'}
        {sequentialStep === 'confirming-second' && '第一笔已确认，链上确认第二笔…'}
        {sequentialStep === 'partial-success' && activeSequentialBatch && '批次已中断，请先核对记录'}
        {sequentialStep === 'partial-success' && !activeSequentialBatch && '批次部分完成，请先核对记录'}
        {sequentialStep === 'recovery-error' && '批次状态暂时无法确认'}
        {!isSequentialLocked && '顺序转账(非原子)'}
      </Button>
      {sequentialStep === 'done' && <p className="text-sm text-emerald-300">两笔转账都已完成</p>}
      {sequentialStep === 'partial-success' && (
        <p className="text-sm text-orange-600 dark:text-orange-400">
          {activeSequentialBatch?.record.stage === 'first-confirmed'
            ? '第一笔已经链上确认，第二笔尚未提交或钱包请求已取消。刷新后不会自动继续，请不要重复整个批次。'
            : '第一笔已经链上确认，第二笔失败或被取消。第一笔不会自动撤销，请不要直接重复整个批次。'}
        </p>
      )}
      {sequentialError && <p className="text-sm text-destructive">{sequentialError}</p>}
    </div>
  )
}
