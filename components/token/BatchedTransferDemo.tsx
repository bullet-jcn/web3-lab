'use client'

import { useState } from 'react'
import { erc20Abi } from 'viem'
import { sepolia } from 'viem/chains'
import { useCapabilities, useSendCalls, useWaitForCallsStatus, useWriteContract } from 'wagmi'
import { DEMO_ERC20_ADDRESS, DEMO_RECIPIENT_A, DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT } from '@/lib/constants'
import { resolveAtomicSupport } from '@/lib/eip5792'

type SequentialStep = 'idle' | 'sending-first' | 'sending-second' | 'done' | 'error'

export function BatchedTransferDemo() {
  const { data: capabilities, isLoading: isCapabilitiesLoading } = useCapabilities({ chainId: sepolia.id })
  const support = resolveAtomicSupport(capabilities?.atomic?.status)

  const { mutate: sendCalls, data: sendCallsResult, isPending: isSendingBatch, error: sendCallsError } = useSendCalls()
  const { data: callsStatus } = useWaitForCallsStatus({ id: sendCallsResult?.id })

  const { mutateAsync: writeContractAsync } = useWriteContract()
  const [sequentialStep, setSequentialStep] = useState<SequentialStep>('idle')
  const [sequentialError, setSequentialError] = useState<string | null>(null)

  function handleAtomicTransfer() {
    sendCalls({
      calls: [
        { to: DEMO_ERC20_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [DEMO_RECIPIENT_A, DEMO_TRANSFER_AMOUNT] },
        { to: DEMO_ERC20_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [DEMO_RECIPIENT_B, DEMO_TRANSFER_AMOUNT] },
      ],
      forceAtomic: true,
    })
  }

  async function handleSequentialTransfer() {
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

  if (isCapabilitiesLoading) {
    return <p>检测钱包能力中…</p>
  }

  const isSendingSequential = sequentialStep === 'sending-first' || sequentialStep === 'sending-second'

  if (support !== 'sequential-fallback') {
    return (
      <div>
        <button onClick={handleAtomicTransfer} disabled={isSendingBatch}>
          {isSendingBatch ? '提交中…' : '批量转账(原子)'}
        </button>
        {support === 'upgrade-then-atomic' && <p>首次使用可能需要先确认一次账户升级</p>}
        {sendCallsError && <p className="text-red-500">{sendCallsError.message}</p>}
        {callsStatus && <p>状态: {callsStatus.status}</p>}
      </div>
    )
  }

  return (
    <div>
      <p className="text-orange-500">
        当前钱包不支持原子批量转账,这两笔转账会分开发送——如果第二笔失败,第一笔不会被撤销。
      </p>
      <button onClick={handleSequentialTransfer} disabled={isSendingSequential}>
        {sequentialStep === 'sending-first' && '发送第一笔…'}
        {sequentialStep === 'sending-second' && '发送第二笔…'}
        {(sequentialStep === 'idle' || sequentialStep === 'done' || sequentialStep === 'error') && '顺序转账(非原子)'}
      </button>
      {sequentialStep === 'done' && <p className="text-green-500">两笔转账都已完成</p>}
      {sequentialError && <p className="text-red-500">{sequentialError}</p>}
    </div>
  )
}
