'use client'

import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useCapabilities, useConnection, useSendCalls, useWaitForCallsStatus, useWriteContract } from 'wagmi'
import { DEMO_ERC20_ADDRESS, DEMO_RECIPIENT_A, DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT } from '@/lib/constants'
import { resolveAtomicSupport } from '@/lib/eip5792'
import { Button } from '@/components/ui/button'
import { useWriteChainGuard } from '@/lib/hooks/useWriteChainGuard'

type SequentialStep = 'idle' | 'sending-first' | 'sending-second' | 'done' | 'error'

export function BatchedTransferDemo() {
  const { address } = useConnection()
  const { writeChain, isCorrectChain, switchToWriteChain, isSwitchingChain, switchChainError } = useWriteChainGuard()

  const { data: capabilities, isLoading: isCapabilitiesLoading } = useCapabilities({ chainId: writeChain.id })
  const support = resolveAtomicSupport(capabilities?.atomic?.status)

  const { mutate: sendCalls, data: sendCallsResult, isPending: isSendingBatch, error: sendCallsError } = useSendCalls()
  const { data: callsStatus } = useWaitForCallsStatus({ id: sendCallsResult?.id })

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
    })
  }

  async function handleSequentialTransfer() {
    if (!address || !isCorrectChain) return
    setSequentialError(null)
    setSequentialStep('sending-first')
    try {
      await writeContractAsync({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [DEMO_RECIPIENT_A, DEMO_TRANSFER_AMOUNT],
      })
      setSequentialStep('sending-second')
      await writeContractAsync({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT],
      })
      setSequentialStep('done')
    } catch (err) {
      setSequentialStep('error')
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

  const isSendingSequential = sequentialStep === 'sending-first' || sequentialStep === 'sending-second'

  if (support !== 'sequential-fallback') {
    return (
      <div className="space-y-2">
        <Button className="w-full" onClick={handleAtomicTransfer} disabled={isSendingBatch}>
          {isSendingBatch ? '提交中…' : '批量转账(原子)'}
        </Button>
        {support === 'upgrade-then-atomic' && (
          <p className="text-sm text-gray-500 dark:text-neutral-400">首次使用可能需要先确认一次账户升级</p>
        )}
        {sendCallsError && <p className="text-sm text-destructive">{sendCallsError.message}</p>}
        {callsStatus && <p className="text-sm">状态: {callsStatus.status}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="rounded-md bg-orange-50 p-2 text-sm text-orange-600 dark:bg-orange-950 dark:text-orange-400">
        当前钱包不支持原子批量转账,这两笔转账会分开发送——如果第二笔失败,第一笔不会被撤销。
      </p>
      <Button className="w-full" onClick={handleSequentialTransfer} disabled={isSendingSequential}>
        {sequentialStep === 'sending-first' && '发送第一笔…'}
        {sequentialStep === 'sending-second' && '发送第二笔…'}
        {(sequentialStep === 'idle' || sequentialStep === 'done' || sequentialStep === 'error') && '顺序转账(非原子)'}
      </Button>
      {sequentialStep === 'done' && <p className="text-sm text-emerald-300">两笔转账都已完成</p>}
      {sequentialError && <p className="text-sm text-destructive">{sequentialError}</p>}
    </div>
  )
}
