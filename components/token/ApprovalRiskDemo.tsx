'use client'

import { erc20Abi, maxUint256, type Address } from 'viem'
import { useState } from 'react'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { Button } from '../ui/Button'
import { assessRisk } from '@/lib/riskCheck'
import { useSession } from '@/lib/hooks/useSession'
import { DEMO_ERC20_ADDRESS, DEMO_SPENDER_ADDRESS, DEMO_TRANSFER_AMOUNT } from '@/lib/constants'

interface PendingApproval {
  spender: Address
  amount: bigint
}

export function ApprovalRiskDemo() {
  const { data: session } = useSession()

  const { mutate: writeContract, data: approveHash } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isApproved } = useWaitForTransactionReceipt({ hash: approveHash })

  const [warning, setWarning] = useState<string | null>(null)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)

  function submitApproval(spender: Address, amount: bigint) {
    writeContract({
      address: DEMO_ERC20_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  async function handleApprove(amount: bigint) {
    const spender = DEMO_SPENDER_ADDRESS
    const findings = assessRisk({ functionName: 'approve', args: [spender, amount] })

    if (findings.length === 0) {
      submitApproval(spender, amount)
      return
    }

    const res = await fetch('/api/risk-copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findings }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      setWarning(error ?? '风险检测失败，请稍后重试')
      return
    }

    const { warning: message } = await res.json()
    setWarning(message)
    setPendingApproval({ spender, amount })
  }

  function handleConfirmDespiteRisk() {
    if (!pendingApproval) return
    submitApproval(pendingApproval.spender, pendingApproval.amount)
    setWarning(null)
    setPendingApproval(null)
  }

  if (!session) {
    return <p className="text-sm text-gray-500 dark:text-neutral-400">登录后可以体验 AI 安全副驾驶</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={() => handleApprove(DEMO_TRANSFER_AMOUNT)} disabled={isConfirming}>
          小额授权（推荐）
        </Button>
        <Button variant="danger" onClick={() => handleApprove(maxUint256)} disabled={isConfirming}>
          无限额度授权（演示风险）
        </Button>
      </div>

      {warning && (
        <div className="rounded-md bg-orange-50 p-3 dark:bg-orange-950">
          <p className="text-sm text-orange-600 dark:text-orange-400">{warning}</p>
          {pendingApproval && (
            <Button variant="danger" onClick={handleConfirmDespiteRisk} className="mt-2">
              我已了解风险，继续
            </Button>
          )}
        </div>
      )}

      {isConfirming && <p className="text-sm text-gray-500 dark:text-neutral-400">确认中...</p>}
      {isApproved && <p className="text-sm text-green-500">授权成功！</p>}
    </div>
  )
}
