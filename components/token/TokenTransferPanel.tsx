'use client'

import { getErrorMessage } from "@/lib/errors";
import { DEMO_ERC20_ADDRESS, DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT } from "@/lib/constants";
import { erc20Abi, parseEther, type Hash, type ReplacementReason } from "viem";
import { useEffect, useState } from "react";
import { useConnection, useReadContract, useSendTransaction, useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useWriteChainGuard } from "@/lib/hooks/useWriteChainGuard";
import { getReplacementMessage, resolveTransactionState } from "@/lib/transactionState";
import { clearPendingTransaction, loadPendingTransaction, savePendingTransaction, type PendingTransactionKind } from "@/lib/pendingTransactionStorage";

interface ReplacementInfo {
    reason: ReplacementReason
    hash: Hash
}

interface TrackedTransaction {
    contextKey: string
    hash: Hash
}

function transactionContextKey(address: `0x${string}` | undefined, chainId: number | undefined, kind: PendingTransactionKind) {
    return address && chainId ? `${chainId}:${address.toLowerCase()}:${kind}` : null
}

export function TokenTransferPanel() {
    const { address } = useConnection()
    const { chainId, writeChain, isCorrectChain, switchToWriteChain, isSwitchingChain, switchChainError } = useWriteChainGuard()
    const transferContextKey = transactionContextKey(address, chainId, 'erc20-transfer')
    const sendContextKey = transactionContextKey(address, chainId, 'native-transfer')

    const { data: tokenBalance } = useReadContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && isCorrectChain,  // 合约地址只在目标链上有确定含义
        },
    })

    const { error: simulateError } = useSimulateContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: address ? [DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT] : undefined,
        query: { enabled: !!address && isCorrectChain },
    })

    const { mutate: writeContract, isPending: isAwaitingTransferWallet, error: writeError } = useWriteContract()
    const [trackedTransfer, setTrackedTransfer] = useState<TrackedTransaction | null>(null)
    const transferHash = trackedTransfer?.contextKey === transferContextKey ? trackedTransfer.hash : undefined
    const [transferReplacement, setTransferReplacement] = useState<ReplacementInfo | null>(null)
    const {
        isLoading: isConfirmingTransfer,
        isSuccess: isTransferConfirmed,
        error: transferReceiptError,
    } = useWaitForTransactionReceipt({
        hash: transferHash,
        onReplaced: ({ reason, transaction }) => {
            setTransferReplacement({ reason, hash: transaction.hash })
            handleReplacement('erc20-transfer', transferContextKey, reason, transaction.hash, setTrackedTransfer)
        },
    })

    const { mutate: sendTransaction, isPending: isAwaitingSendWallet, error: sendError } = useSendTransaction()
    const [trackedSend, setTrackedSend] = useState<TrackedTransaction | null>(null)
    const sendHash = trackedSend?.contextKey === sendContextKey ? trackedSend.hash : undefined
    const [sendReplacement, setSendReplacement] = useState<ReplacementInfo | null>(null)
    const {
        isLoading: isConfirmingSend,
        isSuccess: isSendConfirmed,
        error: sendReceiptError,
    } = useWaitForTransactionReceipt({
        hash: sendHash,
        onReplaced: ({ reason, transaction }) => {
            setSendReplacement({ reason, hash: transaction.hash })
            handleReplacement('native-transfer', sendContextKey, reason, transaction.hash, setTrackedSend)
        },
    })

    useEffect(() => {
        if (!address || !chainId || !transferContextKey) return
        const record = loadPendingTransaction(window.localStorage, { account: address, chainId, kind: 'erc20-transfer' })
        let cancelled = false
        queueMicrotask(() => {
            if (cancelled) return
            setTrackedTransfer((current) => current?.contextKey === transferContextKey
                ? current
                : record ? { contextKey: transferContextKey, hash: record.hash } : null)
            setTransferReplacement(null)
        })
        return () => { cancelled = true }
    }, [address, chainId, transferContextKey])

    useEffect(() => {
        if (!address || !chainId || !sendContextKey) return
        const record = loadPendingTransaction(window.localStorage, { account: address, chainId, kind: 'native-transfer' })
        let cancelled = false
        queueMicrotask(() => {
            if (cancelled) return
            setTrackedSend((current) => current?.contextKey === sendContextKey
                ? current
                : record ? { contextKey: sendContextKey, hash: record.hash } : null)
            setSendReplacement(null)
        })
        return () => { cancelled = true }
    }, [address, chainId, sendContextKey])

    useEffect(() => {
        if (!isTransferConfirmed || !address || !chainId || !transferHash) return
        clearPendingTransaction(window.localStorage, { account: address, chainId, kind: 'erc20-transfer' })
    }, [address, chainId, isTransferConfirmed, transferHash])

    useEffect(() => {
        if (!isSendConfirmed || !address || !chainId || !sendHash) return
        clearPendingTransaction(window.localStorage, { account: address, chainId, kind: 'native-transfer' })
    }, [address, chainId, isSendConfirmed, sendHash])

    function trackSubmittedTransaction(kind: PendingTransactionKind, contextKey: string | null, hash: Hash, setTracked: (value: TrackedTransaction) => void) {
        if (!address || !chainId || !contextKey) return
        savePendingTransaction(window.localStorage, { account: address, chainId, kind, hash })
        setTracked({ contextKey, hash })
    }

    function handleReplacement(kind: PendingTransactionKind, contextKey: string | null, reason: ReplacementReason, hash: Hash, setTracked: (value: TrackedTransaction | null) => void) {
        if (!address || !chainId || !contextKey) return
        if (reason === 'repriced') {
            savePendingTransaction(window.localStorage, { account: address, chainId, kind, hash })
            setTracked({ contextKey, hash })
        } else {
            clearPendingTransaction(window.localStorage, { account: address, chainId, kind })
            setTracked(null)
        }
    }

    function handleTransfer() {
        if (!address || !isCorrectChain) return
        setTransferReplacement(null)
        writeContract({
            address: DEMO_ERC20_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT],
        }, {
            onSuccess: (hash) => trackSubmittedTransaction('erc20-transfer', transferContextKey, hash, setTrackedTransfer),
        })
    }

    function handleSendETH() {
        if (!address || !isCorrectChain) return
        setSendReplacement(null)
        sendTransaction({
            to: DEMO_RECIPIENT_C,
            value: parseEther('0.0001'), // 发送一点点真实的SepoliaETH
        }, {
            onSuccess: (hash) => trackSubmittedTransaction('native-transfer', sendContextKey, hash, setTrackedSend),
        })
    }

    const transferError = writeError ?? transferReceiptError
    const sendTransactionError = sendError ?? sendReceiptError
    const transferState = resolveTransactionState({
        isAwaitingWallet: isAwaitingTransferWallet,
        isConfirming: isConfirmingTransfer,
        isSuccess: isTransferConfirmed,
        error: transferError,
        replacementReason: transferReplacement?.reason,
    })
    const sendState = resolveTransactionState({
        isAwaitingWallet: isAwaitingSendWallet,
        isConfirming: isConfirmingSend,
        isSuccess: isSendConfirmed,
        error: sendTransactionError,
        replacementReason: sendReplacement?.reason,
    })
    const transferErrorMessage = getErrorMessage(transferError)
    const sendErrorMessage = getErrorMessage(sendTransactionError)
    const transferReplacementMessage = getReplacementMessage(transferReplacement?.reason)
    const sendReplacementMessage = getReplacementMessage(sendReplacement?.reason)
    const isTransferBusy = transferState === 'awaiting-wallet' || transferState === 'confirming'
    const isSendBusy = sendState === 'awaiting-wallet' || sendState === 'confirming'

    return (
        <div className="space-y-4">
            {address && !isCorrectChain && (
                <div className="space-y-2 rounded-md bg-orange-50 p-3 dark:bg-orange-950">
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                        当前功能只在 {writeChain.name} 开放，请先切换网络。合约地址在不同链上可能代表不同对象。
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
            )}

            <p className="text-sm text-gray-500 dark:text-neutral-400">
                {tokenBalance !== undefined ? `USDC余额(原始): ${tokenBalance}` : '未查询到余额'}
            </p>

            <div className="space-y-2">
                <Button className="w-full" onClick={handleTransfer} disabled={!address || !isCorrectChain || !!simulateError || isTransferBusy}>
                    {transferState === 'awaiting-wallet' && '等待钱包确认…'}
                    {transferState === 'confirming' && '链上确认中…'}
                    {!isTransferBusy && '转账'}
                </Button>
                {simulateError && <p className="text-sm text-orange-500">预计会失败，暂时无法转账</p>}
                {transferState === 'success' && <p className="text-sm text-emerald-300">转账成功!</p>}
                {transferReplacementMessage && (
                    <p className={transferReplacement?.reason === 'repriced' ? 'text-sm text-muted-foreground' : 'text-sm text-orange-600 dark:text-orange-400'}>
                        {transferReplacementMessage}
                    </p>
                )}
                {transferErrorMessage && (
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-destructive">{transferErrorMessage}</p>
                        <Button variant="ghost" onClick={handleTransfer} disabled={!address || !isCorrectChain || isTransferBusy}>重试</Button>
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-neutral-800">
                <Button className="w-full" variant="outline" onClick={handleSendETH} disabled={!address || !isCorrectChain || isSendBusy}>
                    {sendState === 'awaiting-wallet' && '等待钱包确认…'}
                    {sendState === 'confirming' && '链上确认中…'}
                    {!isSendBusy && '发送ETH'}
                </Button>
                {sendState === 'success' && <p className="text-sm text-emerald-300">发送成功!</p>}
                {sendReplacementMessage && (
                    <p className={sendReplacement?.reason === 'repriced' ? 'text-sm text-muted-foreground' : 'text-sm text-orange-600 dark:text-orange-400'}>
                        {sendReplacementMessage}
                    </p>
                )}
                {sendErrorMessage && <p className="text-sm text-destructive">{sendErrorMessage}</p>}
            </div>
        </div>
    )
}
