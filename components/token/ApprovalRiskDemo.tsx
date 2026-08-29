'use client'

import { erc20Abi, maxUint256, type Address, type Hash, type ReplacementReason } from 'viem'
import { useEffect, useRef, useState } from 'react'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { Button } from '../ui/button'
import { assessRisk, formatDeterministicRiskWarning } from '@/lib/riskCheck'
import { useWalletSession } from '@/lib/hooks/useWalletSession'
import { DEMO_ERC20_ADDRESS, DEMO_SPENDER_ADDRESS, DEMO_TRANSFER_AMOUNT } from '@/lib/constants'
import { useWriteChainGuard } from '@/lib/hooks/useWriteChainGuard'
import { getReplacementMessage, resolveTransactionState } from '@/lib/transactionState'
import { getErrorMessage } from '@/lib/errors'
import { clearPendingTransaction, loadPendingTransaction, savePendingTransaction } from '@/lib/pendingTransactionStorage'

interface PendingApproval {
  spender: Address
  amount: bigint
  contextKey: string
}

interface ApprovalWarning {
  message: string
  contextKey: string
}

interface ApprovalReplacement {
  reason: ReplacementReason
  hash: Hash
  contextKey: string
}

interface TrackedApproval {
  hash: Hash
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

  const {
    mutate: writeContract,
    isPending: isAwaitingWallet,
    error: writeError,
  } = useWriteContract()
  const [trackedApproval, setTrackedApproval] = useState<TrackedApproval | null>(null)
  const approveHash = trackedApproval?.contextKey === approvalContextKey ? trackedApproval.hash : undefined
  const {
    isLoading: isConfirming,
    isSuccess: isApproved,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: approveHash,
    onReplaced: ({ reason, transaction }) => {
      setApprovalReplacement({ reason, hash: transaction.hash, contextKey: approvalContextKey })
      if (!walletAddress || !chainId) return
      if (reason === 'repriced') {
        savePendingTransaction(window.localStorage, {
          account: walletAddress,
          chainId,
          kind: 'approval',
          hash: transaction.hash,
        })
        setTrackedApproval({ hash: transaction.hash, contextKey: approvalContextKey })
      } else {
        clearPendingTransaction(window.localStorage, { account: walletAddress, chainId, kind: 'approval' })
        setTrackedApproval(null)
      }
    },
  })

  const [warning, setWarning] = useState<ApprovalWarning | null>(null)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)
  const [approvalReplacement, setApprovalReplacement] = useState<ApprovalReplacement | null>(null)
  const [isRiskChecking, setIsRiskChecking] = useState(false)
  const visibleWarning = warning?.contextKey === approvalContextKey ? warning.message : null
  const activePendingApproval = pendingApproval?.contextKey === approvalContextKey ? pendingApproval : null
  const activeApprovalReplacement = approvalReplacement?.contextKey === approvalContextKey ? approvalReplacement : null
  const approvalError = writeError ?? receiptError
  const approvalState = resolveTransactionState({
    isAwaitingWallet,
    isConfirming,
    isSuccess: isApproved,
    error: approvalError,
    replacementReason: activeApprovalReplacement?.reason,
  })
  const approvalErrorMessage = getErrorMessage(approvalError)
  const approvalReplacementMessage = getReplacementMessage(activeApprovalReplacement?.reason)
  const isApprovalBusy = isRiskChecking || approvalState === 'awaiting-wallet' || approvalState === 'confirming'

  useEffect(() => {
    if (!walletAddress || !chainId || !isAuthenticatedWallet) return
    const record = loadPendingTransaction(window.localStorage, {
      account: walletAddress,
      chainId,
      kind: 'approval',
    })
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setTrackedApproval((current) => current?.contextKey === approvalContextKey
        ? current
        : record ? { hash: record.hash, contextKey: approvalContextKey } : null)
      setApprovalReplacement(null)
    })
    return () => { cancelled = true }
  }, [approvalContextKey, chainId, isAuthenticatedWallet, walletAddress])

  useEffect(() => {
    if (!isApproved || !walletAddress || !chainId || !approveHash) return
    clearPendingTransaction(window.localStorage, { account: walletAddress, chainId, kind: 'approval' })
  }, [approveHash, chainId, isApproved, walletAddress])

  function submitApproval(spender: Address, amount: bigint) {
    if (!isAuthenticatedWallet || !isCorrectChain) return
    setApprovalReplacement(null)
    writeContract({
      address: DEMO_ERC20_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    }, {
      onSuccess: (hash) => {
        if (!walletAddress || !chainId) return
        savePendingTransaction(window.localStorage, {
          account: walletAddress,
          chainId,
          kind: 'approval',
          hash,
        })
        setTrackedApproval({ hash, contextKey: approvalContextKey })
      },
    })
  }

  async function handleApprove(amount: bigint) {
    if (!isAuthenticatedWallet || !isCorrectChain || isApprovalBusy) return
    const requestContextKey = approvalContextKey
    const spender = DEMO_SPENDER_ADDRESS
    const findings = assessRisk({ functionName: 'approve', args: [spender, amount] })
    const deterministicWarning = formatDeterministicRiskWarning(findings)

    if (findings.length === 0) {
      submitApproval(spender, amount)
      return
    }

    setWarning(null)
    setPendingApproval(null)
    setIsRiskChecking(true)

    try {
      const res = await fetch('/api/risk-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findings }),
      })

      if (!res.ok) {
        let errorMessage = '风险检测失败，请稍后重试'
        try {
          const body: unknown = await res.json()
          if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
            errorMessage = body.error
          }
        } catch {
          // An explicit non-2xx response still blocks approval even if its body is malformed.
        }
        if (currentContextKeyRef.current !== requestContextKey) return
        setWarning({ message: errorMessage, contextKey: requestContextKey })
        return
      }

      const body: unknown = await res.json()
      if (!body || typeof body !== 'object' || !('warning' in body) || typeof body.warning !== 'string' || !body.warning.trim()) {
        throw new Error('risk explanation response is malformed')
      }
      const message = body.warning
      if (currentContextKeyRef.current !== requestContextKey) return
      setWarning({ message, contextKey: requestContextKey })
      setPendingApproval({ spender, amount, contextKey: requestContextKey })
    } catch {
      if (currentContextKeyRef.current !== requestContextKey) return
      setWarning({
        message: `AI 解释服务暂时无法连接。${deterministicWarning}`,
        contextKey: requestContextKey,
      })
      setPendingApproval({ spender, amount, contextKey: requestContextKey })
    } finally {
      setIsRiskChecking(false)
    }
  }

  function handleConfirmDespiteRisk() {
    if (!activePendingApproval || isApprovalBusy) return
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
        <Button onClick={() => handleApprove(DEMO_TRANSFER_AMOUNT)} disabled={isApprovalBusy}>
          小额授权（推荐）
        </Button>
        <Button variant="destructive" onClick={() => handleApprove(maxUint256)} disabled={isApprovalBusy}>
          无限额度授权（演示风险）
        </Button>
      </div>

      {visibleWarning && (
        <div className="rounded-md bg-orange-50 p-3 dark:bg-orange-950">
          <p className="text-sm text-orange-600 dark:text-orange-400">{visibleWarning}</p>
          {activePendingApproval && (
            <Button variant="destructive" onClick={handleConfirmDespiteRisk} className="mt-2" disabled={isApprovalBusy}>
              我已了解风险，继续
            </Button>
          )}
        </div>
      )}

      {isRiskChecking && <p className="text-sm text-muted-foreground">AI 风险检测中…</p>}
      {approvalState === 'awaiting-wallet' && <p className="text-sm text-muted-foreground">等待钱包确认授权…</p>}
      {approvalState === 'confirming' && <p className="text-sm text-muted-foreground">授权交易链上确认中…</p>}
      {approvalState === 'success' && <p className="text-sm text-emerald-300">授权成功！</p>}
      {approvalReplacementMessage && (
        <p className={activeApprovalReplacement?.reason === 'repriced' ? 'text-sm text-muted-foreground' : 'text-sm text-orange-600 dark:text-orange-400'}>
          {approvalReplacementMessage}
        </p>
      )}
      {approvalErrorMessage && <p className="text-sm text-destructive">{approvalErrorMessage}</p>}
    </div>
  )
}
