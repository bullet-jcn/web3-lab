'use client'

import { getErrorMessage } from "@/lib/errors";
import { DEMO_ERC20_ADDRESS, DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT } from "@/lib/constants";
import { erc20Abi, parseEther } from "viem";
import { useConnection, useReadContract, useSendTransaction, useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useWriteChainGuard } from "@/lib/hooks/useWriteChainGuard";

export function TokenTransferPanel() {
    const { address } = useConnection()
    const { writeChain, isCorrectChain, switchToWriteChain, isSwitchingChain, switchChainError } = useWriteChainGuard()

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

    const { mutate: writeContract, data: transferHash, error: writeError } = useWriteContract()
    const { isLoading: isConfirmingTransfer, isSuccess: isTransferConfirmed } = useWaitForTransactionReceipt({ hash: transferHash })

    const { mutate: sendTransaction, data: sendHash, error: sendError } = useSendTransaction()
    const { isLoading: isConfirmingSend, isSuccess: isSendConfirmed } = useWaitForTransactionReceipt({ hash: sendHash })

    function handleTransfer() {
        if (!address || !isCorrectChain) return
        writeContract({
            address: DEMO_ERC20_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT],
        })
    }

    function handleSendETH() {
        if (!address || !isCorrectChain) return
        sendTransaction({
            to: DEMO_RECIPIENT_C,
            value: parseEther('0.0001'), // 发送一点点真实的SepoliaETH
        })
    }

    const transferErrorMessage = getErrorMessage(writeError)
    const sendErrorMessage = getErrorMessage(sendError)

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
                <Button className="w-full" onClick={handleTransfer} disabled={!address || !isCorrectChain || !!simulateError || isConfirmingTransfer}>
                    {isConfirmingTransfer ? '确认中...' : '转账'}
                </Button>
                {simulateError && <p className="text-sm text-orange-500">预计会失败，暂时无法转账</p>}
                {isTransferConfirmed && <p className="text-sm text-emerald-300">转账成功!</p>}
                {transferErrorMessage && (
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-destructive">{transferErrorMessage}</p>
                        <Button variant="ghost" onClick={handleTransfer} disabled={!isCorrectChain}>重试</Button>
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-neutral-800">
                <Button className="w-full" variant="outline" onClick={handleSendETH} disabled={!address || !isCorrectChain || isConfirmingSend}>
                    {isConfirmingSend ? '发送中...' : '发送ETH'}
                </Button>
                {isSendConfirmed && <p className="text-sm text-emerald-300">发送成功!</p>}
                {sendErrorMessage && <p className="text-sm text-destructive">{sendErrorMessage}</p>}
            </div>
        </div>
    )
}
