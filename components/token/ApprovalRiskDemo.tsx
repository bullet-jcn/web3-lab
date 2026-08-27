'use client'

import { erc20Abi, maxUint256, type Address } from 'viem'
import { useEffect, useRef, useState } from 'react'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { Button } from '../ui/button'
import { assessRisk } from '@/lib/riskCheck'
import { useWalletSession } from '@/lib/hooks/useWalletSession'
import { DEMO_ERC20_ADDRESS, DEMO_SPENDER_ADDRESS, DEMO_TRANSFER_AMOUNT } from '@/lib/constants'
import { useWriteChainGuard } from '@/lib/hooks/useWriteChainGuard'

interface PendingApproval {
  spender: Address
  amount: bigint
  contextKey: string
}

interface ApprovalWarning {
  message: string
  contextKey: string
}

export function ApprovalRiskDemo() {
  const { session, walletAddress, chainId, status: sessionStatus, isAuthenticatedWallet } = useWalletSession()
  const { writeChain, isCorrectChain, switchToWriteChain, isSwitchingChain, switchChainError } = useWriteChainGuard()
  const approvalContextKey = [session?.address, walletAddress, chainId]
    .map((value) => String(value ?? '').toLowerCase())
    .join(':')
  const currentContextKeyRef = useRef(approvalContextKey)

  useEffect(() => {
    currentContextKeyRef.current = approvalContextKey
  }, [approvalContextKey])

  const { mutate: writeContract, data: approveHash } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isApproved } = useWaitForTransactionReceipt({ hash: approveHash })

  const [warning, setWarning] = useState<ApprovalWarning | null>(null)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)
  const visibleWarning = warning?.contextKey === approvalContextKey ? warning.message : null
  const activePendingApproval = pendingApproval?.contextKey === approvalContextKey ? pendingApproval : null

  function submitApproval(spender: Address, amount: bigint) {
    if (!isAuthenticatedWallet || !isCorrectChain) return
    writeContract({
      address: DEMO_ERC20_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  async function handleApprove(amount: bigint) {
    if (!isAuthenticatedWallet || !isCorrectChain) return
    const requestContextKey = approvalContextKey
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
      if (currentContextKeyRef.current !== requestContextKey) return
      setWarning({ message: error ?? '风险检测失败，请稍后重试', contextKey: requestContextKey })
      return
    }

    const { warning: message } = await res.json()
    if (currentContextKeyRef.current !== requestContextKey) return
    setWarning({ message, contextKey: requestContextKey })
    setPendingApproval({ spender, amount, contextKey: requestContextKey })
  }

  function handleConfirmDespiteRisk() {
    if (!activePendingApproval) return
    submitApproval(activePendingApproval.spender, activePendingApproval.amount)
    setWarning(null)
    setPendingApproval(null)
  }

  if (!session) {
    return <p className="text-sm text-muted-foreground">登录后可以体验 AI 安全副驾驶</p>
  }

  if (!isAuthenticatedWallet) {
    const message = sessionStatus === 'account-mismatch'
      ? '当前钱包与登录账户不一致，已阻止授权操作。请先退出旧会话并重新登录。'
      : '钱包已断开，已阻止授权操作。请重新连接登录账户。'
    return <p className="text-sm text-destructive">{message}</p>
  }

  if (!isCorrectChain) {
    return (
      <div className="space-y-2 rounded-md bg-orange-50 p-3 dark:bg-orange-950">
        <p className="text-sm text-orange-600 dark:text-orange-400">
          授权目标合约部署在 {writeChain.name}，请先切换网络后再进行风险检测和签名。
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

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={() => handleApprove(DEMO_TRANSFER_AMOUNT)} disabled={isConfirming}>
          小额授权（推荐）
        </Button>
        <Button variant="destructive" onClick={() => handleApprove(maxUint256)} disabled={isConfirming}>
          无限额度授权（演示风险）
        </Button>
      </div>

      {visibleWarning && (
        <div className="rounded-md bg-orange-50 p-3 dark:bg-orange-950">
          <p className="text-sm text-orange-600 dark:text-orange-400">{visibleWarning}</p>
          {activePendingApproval && (
            <Button variant="destructive" onClick={handleConfirmDespiteRisk} className="mt-2">
              我已了解风险，继续
            </Button>
          )}
        </div>
      )}

      {isConfirming && <p className="text-sm text-muted-foreground">确认中...</p>}
      {isApproved && <p className="text-sm text-emerald-300">授权成功！</p>}
    </div>
  )
}
