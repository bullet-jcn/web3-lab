'use client'

import { getErrorMessage } from "@/lib/errors";
import { DEMO_ERC20_ADDRESS } from "@/lib/constants";
import { encodeFunctionData, erc20Abi, formatEther, formatUnits, type Hash, type ReplacementReason } from "viem";
import { useEffect, useState } from "react";
import { useBalance, useConnection, useEstimateFeesPerGas, useEstimateGas, useReadContract, useSendTransaction, useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useWriteChainGuard } from "@/lib/hooks/useWriteChainGuard";
import { getReplacementMessage, resolveTransactionState } from "@/lib/transactionState";
import { clearPendingTransaction, loadPendingTransaction, savePendingTransaction, type PendingTransactionKind } from "@/lib/pendingTransactionStorage";
import { parseNativeTransferInput } from "@/lib/nativeTransferInput";
import { Input } from "@/components/ui/input";
import { parseErc20TransferInput } from "@/lib/erc20TransferInput";
import { resolveTokenBalanceState } from "@/lib/tokenBalance";
import { resolveNativeTransferBudget } from "@/lib/nativeTransferBudget";
import { createTransferReview, type TransferReview } from "@/lib/transferReview";

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
    const reviewContextKey = address && chainId ? `${chainId}:${address.toLowerCase()}` : null
    const [review, setReview] = useState<TransferReview | null>(null)
    const [nativeRecipient, setNativeRecipient] = useState('')
    const [nativeAmount, setNativeAmount] = useState('')
    const nativeTransferInput = parseNativeTransferInput(nativeRecipient, nativeAmount)
    const isNativeRequestReady = !!address && isCorrectChain && nativeTransferInput.ok
    const { data: nativeBalance, error: nativeBalanceError, refetch: refetchNativeBalance } = useBalance({
        address,
        chainId: writeChain.id,
        query: { enabled: !!address && isCorrectChain },
    })
    const { data: estimatedNativeGas, error: nativeGasError } = useEstimateGas({
        account: address,
        chainId: writeChain.id,
        to: nativeTransferInput.ok ? nativeTransferInput.recipient : undefined,
        value: nativeTransferInput.ok ? nativeTransferInput.value : undefined,
        query: { enabled: isNativeRequestReady },
    })
    const [erc20Recipient, setErc20Recipient] = useState('')
    const [erc20Amount, setErc20Amount] = useState('')

    const { data: tokenDecimals, error: tokenDecimalsError } = useReadContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'decimals',
        query: { enabled: isCorrectChain },
    })
    const { data: rawTokenSymbol } = useReadContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'symbol',
        query: { enabled: isCorrectChain },
    })
    const tokenSymbol = typeof rawTokenSymbol === 'string'
        && rawTokenSymbol.length > 0
        && rawTokenSymbol.length <= 12
        && /^[\x20-\x7e]+$/.test(rawTokenSymbol)
        ? rawTokenSymbol
        : 'ERC-20'
    const erc20TransferInput = parseErc20TransferInput(erc20Recipient, erc20Amount, tokenDecimals)
    const isErc20RequestReady = !!address && isCorrectChain && erc20TransferInput.ok
    const erc20CallData = erc20TransferInput.ok
        ? encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [erc20TransferInput.recipient, erc20TransferInput.amount],
        })
        : undefined
    const { data: estimatedErc20Gas, error: erc20GasError } = useEstimateGas({
        account: address,
        chainId: writeChain.id,
        to: DEMO_ERC20_ADDRESS,
        data: erc20CallData,
        query: { enabled: isErc20RequestReady },
    })
    const { data: feeEstimate, error: feesError } = useEstimateFeesPerGas({
        chainId: writeChain.id,
        type: 'eip1559',
        query: { enabled: isNativeRequestReady || isErc20RequestReady },
    })
    const nativeTransferBudget = resolveNativeTransferBudget({
        value: nativeTransferInput.ok ? nativeTransferInput.value : undefined,
        balance: nativeBalance?.value,
        gas: estimatedNativeGas,
        maxFeePerGas: feeEstimate?.maxFeePerGas,
    })
    const erc20GasBudget = resolveNativeTransferBudget({
        value: BigInt(0),
        balance: nativeBalance?.value,
        gas: estimatedErc20Gas,
        maxFeePerGas: feeEstimate?.maxFeePerGas,
    })

    const { data: tokenBalance, error: tokenBalanceError, refetch: refetchTokenBalance } = useReadContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && isCorrectChain,  // 合约地址只在目标链上有确定含义
        },
    })
    const tokenBalanceState = resolveTokenBalanceState(
        erc20TransferInput.ok ? erc20TransferInput.amount : undefined,
        tokenBalance,
    )
    const { error: simulateError } = useSimulateContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: erc20TransferInput.ok ? [erc20TransferInput.recipient, erc20TransferInput.amount] : undefined,
        query: { enabled: !!address && isCorrectChain && erc20TransferInput.ok },
    })
    const activeReview = review?.contextKey !== reviewContextKey
        ? null
        : review.kind === 'native'
            ? nativeTransferBudget.state === 'sufficient'
                && nativeBalance?.value === review.balance
                && nativeTransferBudget.gasCostLimit === review.gasCostLimit
                ? review
                : null
            : tokenBalance === review.balance
                && tokenDecimals === review.decimals
                && nativeBalance?.value === review.nativeBalance
                && erc20GasBudget.state === 'sufficient'
                && erc20GasBudget.gasCostLimit === review.gasCostLimit
                && !simulateError
                ? review
                : null

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
        let cancelled = false
        queueMicrotask(() => {
            if (!cancelled) setReview(null)
        })
        return () => { cancelled = true }
    }, [reviewContextKey])

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
        void refetchTokenBalance()
        void refetchNativeBalance()
    }, [address, chainId, isTransferConfirmed, refetchNativeBalance, refetchTokenBalance, transferHash])

    useEffect(() => {
        if (!isSendConfirmed || !address || !chainId || !sendHash) return
        clearPendingTransaction(window.localStorage, { account: address, chainId, kind: 'native-transfer' })
        void refetchNativeBalance()
    }, [address, chainId, isSendConfirmed, refetchNativeBalance, sendHash])

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

    function openErc20Review() {
        if (!reviewContextKey || !chainId || !isCorrectChain || !erc20TransferInput.ok || tokenBalanceState !== 'sufficient' || erc20GasBudget.state !== 'sufficient' || tokenBalance === undefined || tokenDecimals === undefined || nativeBalance === undefined || simulateError) return
        setReview(createTransferReview({
            kind: 'erc20',
            contextKey: reviewContextKey,
            chainId,
            chainName: writeChain.name,
            tokenAddress: DEMO_ERC20_ADDRESS,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            recipient: erc20TransferInput.recipient,
            displayAmount: erc20Amount.trim(),
            amount: erc20TransferInput.amount,
            balance: tokenBalance,
            nativeBalance: nativeBalance.value,
            gasCostLimit: erc20GasBudget.gasCostLimit,
        }))
    }

    function confirmErc20Transfer() {
        if (!address || !isCorrectChain || activeReview?.kind !== 'erc20' || tokenBalance === undefined || nativeBalance === undefined || activeReview.amount > tokenBalance || activeReview.gasCostLimit > nativeBalance.value) return
        setTransferReplacement(null)
        writeContract({
            address: activeReview.tokenAddress,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [activeReview.recipient, activeReview.amount],
        }, {
            onSuccess: (hash) => {
                trackSubmittedTransaction('erc20-transfer', transferContextKey, hash, setTrackedTransfer)
                setReview(null)
            },
        })
    }

    function openNativeReview() {
        if (!reviewContextKey || !chainId || !isCorrectChain || !nativeTransferInput.ok || nativeTransferBudget.state !== 'sufficient' || nativeBalance === undefined) return
        setReview(createTransferReview({
            kind: 'native',
            contextKey: reviewContextKey,
            chainId,
            chainName: writeChain.name,
            recipient: nativeTransferInput.recipient,
            displayAmount: nativeAmount.trim(),
            symbol: 'ETH',
            value: nativeTransferInput.value,
            gasCostLimit: nativeTransferBudget.gasCostLimit,
            balance: nativeBalance.value,
        }))
    }

    function confirmNativeTransfer() {
        if (!address || !isCorrectChain || activeReview?.kind !== 'native' || nativeBalance === undefined || activeReview.value + activeReview.gasCostLimit > nativeBalance.value) return
        setSendReplacement(null)
        sendTransaction({
            to: activeReview.recipient,
            value: activeReview.value,
        }, {
            onSuccess: (hash) => {
                trackSubmittedTransaction('native-transfer', sendContextKey, hash, setTrackedSend)
                setReview(null)
            },
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
                {tokenBalance !== undefined && tokenDecimals !== undefined
                    ? `${tokenSymbol} 余额: ${formatUnits(tokenBalance, tokenDecimals)}`
                    : '正在读取代币信息…'}
            </p>

            <div className="space-y-2">
                <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="erc20-recipient">ERC-20 收款地址</label>
                    <Input
                        id="erc20-recipient"
                        value={erc20Recipient}
                        onChange={(event) => { setErc20Recipient(event.target.value); setReview(null) }}
                        placeholder="0x…"
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={!!erc20Recipient && !erc20TransferInput.ok && !!erc20TransferInput.recipientError}
                    />
                    {!!erc20Recipient && !erc20TransferInput.ok && erc20TransferInput.recipientError && (
                        <p className="text-sm text-destructive">{erc20TransferInput.recipientError}</p>
                    )}
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="erc20-amount">{tokenSymbol} 数量</label>
                    <Input
                        id="erc20-amount"
                        value={erc20Amount}
                        onChange={(event) => { setErc20Amount(event.target.value); setReview(null) }}
                        placeholder="1.0"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-invalid={!!erc20Amount && !erc20TransferInput.ok && !!erc20TransferInput.amountError}
                    />
                    {!!erc20Amount && !erc20TransferInput.ok && erc20TransferInput.amountError && (
                        <p className="text-sm text-destructive">{erc20TransferInput.amountError}</p>
                    )}
                    {tokenDecimalsError && <p className="text-sm text-destructive">无法读取代币精度，已阻止转账</p>}
                    {tokenBalanceError && <p className="text-sm text-destructive">无法读取代币余额，已阻止转账</p>}
                    {nativeBalanceError && <p className="text-sm text-destructive">无法读取 Gas 余额，已阻止 ERC-20 转账</p>}
                    {(erc20GasError || feesError) && <p className="text-sm text-destructive">无法估算 ERC-20 Gas，已阻止转账</p>}
                    {erc20TransferInput.ok && tokenBalanceState === 'insufficient' && tokenBalance !== undefined && tokenDecimals !== undefined && (
                        <p className="text-sm text-destructive">
                            余额不足，当前可用 {formatUnits(tokenBalance, tokenDecimals)} {tokenSymbol}
                        </p>
                    )}
                    {erc20GasBudget.state !== 'unavailable' && (
                        <p className="text-sm text-muted-foreground">ERC-20 预留最高 Gas 成本: {formatEther(erc20GasBudget.gasCostLimit)} ETH</p>
                    )}
                    {erc20GasBudget.state === 'insufficient' && (
                        <p className="text-sm text-destructive">ETH 不足以支付 ERC-20 Gas，预算还差 {formatEther(erc20GasBudget.shortfall)} ETH</p>
                    )}
                </div>
                <Button className="w-full" onClick={openErc20Review} disabled={!address || !isCorrectChain || !erc20TransferInput.ok || tokenBalanceState !== 'sufficient' || erc20GasBudget.state !== 'sufficient' || !!simulateError || isTransferBusy}>
                    {transferState === 'awaiting-wallet' && '等待钱包确认…'}
                    {transferState === 'confirming' && '链上确认中…'}
                    {!isTransferBusy && '预览 ERC-20 转账'}
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
                        <Button variant="ghost" onClick={openErc20Review} disabled={!address || !isCorrectChain || !erc20TransferInput.ok || tokenBalanceState !== 'sufficient' || isTransferBusy}>重新预览</Button>
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-neutral-800">
                <p className="text-sm text-gray-500 dark:text-neutral-400">
                    {nativeBalance ? `ETH 余额: ${formatEther(nativeBalance.value)}` : '正在读取 ETH 余额…'}
                </p>
                <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="native-recipient">ETH 收款地址</label>
                    <Input
                        id="native-recipient"
                        value={nativeRecipient}
                        onChange={(event) => { setNativeRecipient(event.target.value); setReview(null) }}
                        placeholder="0x…"
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={!!nativeRecipient && !nativeTransferInput.ok && !!nativeTransferInput.recipientError}
                    />
                    {!!nativeRecipient && !nativeTransferInput.ok && nativeTransferInput.recipientError && (
                        <p className="text-sm text-destructive">{nativeTransferInput.recipientError}</p>
                    )}
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="native-amount">ETH 数量</label>
                    <Input
                        id="native-amount"
                        value={nativeAmount}
                        onChange={(event) => { setNativeAmount(event.target.value); setReview(null) }}
                        placeholder="0.001"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-invalid={!!nativeAmount && !nativeTransferInput.ok && !!nativeTransferInput.amountError}
                    />
                    {!!nativeAmount && !nativeTransferInput.ok && nativeTransferInput.amountError && (
                        <p className="text-sm text-destructive">{nativeTransferInput.amountError}</p>
                    )}
                    {nativeBalanceError && <p className="text-sm text-destructive">无法读取 ETH 余额，已阻止转账</p>}
                    {(nativeGasError || feesError) && <p className="text-sm text-destructive">无法估算 Gas 成本，已阻止转账</p>}
                    {nativeTransferBudget.state !== 'unavailable' && (
                        <p className="text-sm text-muted-foreground">
                            预留最高 Gas 成本: {formatEther(nativeTransferBudget.gasCostLimit)} ETH
                        </p>
                    )}
                    {nativeTransferBudget.state === 'insufficient' && (
                        <p className="text-sm text-destructive">
                            ETH 余额不足，转账金额加 Gas 预算还差 {formatEther(nativeTransferBudget.shortfall)} ETH
                        </p>
                    )}
                </div>
                <Button className="w-full" variant="outline" onClick={openNativeReview} disabled={!address || !isCorrectChain || !nativeTransferInput.ok || nativeTransferBudget.state !== 'sufficient' || isSendBusy}>
                    {sendState === 'awaiting-wallet' && '等待钱包确认…'}
                    {sendState === 'confirming' && '链上确认中…'}
                    {!isSendBusy && '预览 ETH 转账'}
                </Button>
                {sendState === 'success' && <p className="text-sm text-emerald-300">发送成功!</p>}
                {sendReplacementMessage && (
                    <p className={sendReplacement?.reason === 'repriced' ? 'text-sm text-muted-foreground' : 'text-sm text-orange-600 dark:text-orange-400'}>
                        {sendReplacementMessage}
                    </p>
                )}
                {sendErrorMessage && <p className="text-sm text-destructive">{sendErrorMessage}</p>}
            </div>

            {activeReview && (
                <div className="space-y-3 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
                    <div>
                        <p className="font-semibold">确认转账详情</p>
                        <p className="text-xs text-muted-foreground">核对后才会打开钱包；钱包内容必须与这里一致。</p>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">网络</dt><dd>{activeReview.chainName} ({activeReview.chainId})</dd>
                        <dt className="text-muted-foreground">资产</dt><dd>{activeReview.symbol}</dd>
                        <dt className="text-muted-foreground">收款人</dt><dd className="break-all font-mono">{activeReview.recipient}</dd>
                        <dt className="text-muted-foreground">显示金额</dt><dd>{activeReview.displayAmount} {activeReview.symbol}</dd>
                        <dt className="text-muted-foreground">最小单位</dt><dd className="break-all font-mono">{activeReview.kind === 'native' ? activeReview.value.toString() : activeReview.amount.toString()}</dd>
                        <dt className="text-muted-foreground">可用余额</dt><dd>{activeReview.kind === 'native' ? formatEther(activeReview.balance) : formatUnits(activeReview.balance, activeReview.decimals)} {activeReview.symbol}</dd>
                        {activeReview.kind === 'erc20' && <><dt className="text-muted-foreground">代币合约</dt><dd className="break-all font-mono">{activeReview.tokenAddress}</dd><dt className="text-muted-foreground">Gas 支付余额</dt><dd>{formatEther(activeReview.nativeBalance)} ETH</dd></>}
                        <dt className="text-muted-foreground">Gas 预算上限</dt><dd>{formatEther(activeReview.gasCostLimit)} ETH</dd>
                    </dl>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setReview(null)} disabled={isTransferBusy || isSendBusy}>返回修改</Button>
                        <Button
                            onClick={activeReview.kind === 'native' ? confirmNativeTransfer : confirmErc20Transfer}
                            disabled={isTransferBusy || isSendBusy}
                        >确认并打开钱包</Button>
                    </div>
                </div>
            )}
        </div>
    )
}
