'use client'

import { useEffect, useState } from 'react'
import { erc20Abi } from 'viem'
import { useCapabilities, useConnection, usePublicClient, useSendCalls, useWaitForCallsStatus, useWriteContract } from 'wagmi'
import { DEMO_ERC20_ADDRESS, DEMO_RECIPIENT_A, DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT } from '@/lib/constants'
import { resolveAtomicBatchState, resolveAtomicSupport } from '@/lib/eip5792'
import { Button } from '@/components/ui/button'
import { useWriteChainGuard } from '@/lib/hooks/useWriteChainGuard'
import { getErrorMessage } from '@/lib/errors'
import { clearPendingBatch, loadPendingBatch, savePendingBatch } from '@/lib/pendingBatchStorage'

type SequentialStep =
  | 'idle'
  | 'awaiting-first-wallet'
  | 'confirming-first'
  | 'awaiting-second-wallet'
  | 'confirming-second'
  | 'done'
  | 'partial-success'
  | 'error'

export function BatchedTransferDemo() {
  const { address } = useConnection()
  const { chainId, writeChain, isCorrectChain, switchToWriteChain, isSwitchingChain, switchChainError } = useWriteChainGuard()
  const publicClient = usePublicClient({ chainId: writeChain.id })
  const atomicContextKey = address && chainId ? `${chainId}:${address.toLowerCase()}:atomic` : null

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
    if (!address || !isCorrectChain || !publicClient) return
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
      setSequentialStep('confirming-first')
      const firstReceipt = await publicClient.waitForTransactionReceipt({ hash: firstHash })
      if (firstReceipt.status !== 'success') throw new Error('execution reverted: first transfer')
      firstTransferConfirmed = true

      setSequentialStep('awaiting-second-wallet')
      const secondHash = await writeContractAsync({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT],
      })
      setSequentialStep('confirming-second')
      const secondReceipt = await publicClient.waitForTransactionReceipt({ hash: secondHash })
      if (secondReceipt.status !== 'success') throw new Error('execution reverted: second transfer')
      setSequentialStep('done')
    } catch (err) {
      setSequentialStep(firstTransferConfirmed ? 'partial-success' : 'error')
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

  if (support !== 'sequential-fallback' || !!atomicBatchId) {
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
      <Button className="w-full" onClick={handleSequentialTransfer} disabled={!publicClient || isSendingSequential}>
        {sequentialStep === 'awaiting-first-wallet' && '等待确认第一笔…'}
        {sequentialStep === 'confirming-first' && '链上确认第一笔…'}
        {sequentialStep === 'awaiting-second-wallet' && '第一笔已确认，等待确认第二笔…'}
        {sequentialStep === 'confirming-second' && '第一笔已确认，链上确认第二笔…'}
        {!isSendingSequential && '顺序转账(非原子)'}
      </Button>
      {sequentialStep === 'done' && <p className="text-sm text-emerald-300">两笔转账都已完成</p>}
      {sequentialStep === 'partial-success' && (
        <p className="text-sm text-orange-600 dark:text-orange-400">
          第一笔已经链上确认，第二笔失败或被取消。第一笔不会自动撤销，请不要直接重复整个批次。
        </p>
      )}
      {sequentialError && <p className="text-sm text-destructive">{sequentialError}</p>}
    </div>
  )
}
