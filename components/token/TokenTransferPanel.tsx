'use client'

import { getErrorMessage } from "@/lib/errors";
import { DEMO_ERC20_ADDRESS, DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT } from "@/lib/constants";
import { erc20Abi, parseEther } from "viem";
import { useConnection, useReadContract, useSendTransaction, useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

export function TokenTransferPanel() {
    const { address } = useConnection()

    const { data: tokenBalance } = useReadContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,  // 只有 address 存在时，才真正发起这个查询
        },
    })

    const { error: simulateError } = useSimulateContract({
        address: DEMO_ERC20_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: address ? [DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT] : undefined,
        query: { enabled: !!address },
    })

    const { mutate: writeContract, data: transferHash, error: writeError } = useWriteContract()
    const { isLoading: isConfirmingTransfer, isSuccess: isTransferConfirmed } = useWaitForTransactionReceipt({ hash: transferHash })

    const { mutate: sendTransaction, data: sendHash, error: sendError } = useSendTransaction()
    const { isLoading: isConfirmingSend, isSuccess: isSendConfirmed } = useWaitForTransactionReceipt({ hash: sendHash })

    function handleTransfer() {
        writeContract({
            address: DEMO_ERC20_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [DEMO_RECIPIENT_C, DEMO_TRANSFER_AMOUNT],
        })
    }

    function handleSendETH() {
        sendTransaction({
            to: DEMO_RECIPIENT_C,
            value: parseEther('0.0001'), // 发送一点点真实的SepoliaETH
        })
    }

    const transferErrorMessage = getErrorMessage(writeError)
    const sendErrorMessage = getErrorMessage(sendError)

    return (
        <div>
            <p>
                {tokenBalance !== undefined ? `USDC余额(原始): ${tokenBalance}` : '未查询到余额'}
            </p>

            <div>
                <button onClick={handleTransfer} disabled={!address || !!simulateError || isConfirmingTransfer}>
                    {isConfirmingTransfer ? '确认中...' : '转账'}
                </button>
                {simulateError && <p className="text-orange-500">预计会失败，暂时无法转账</p>}
                {isTransferConfirmed && <p className="text-green-500">转账成功!</p>}
                {transferErrorMessage && (
                    <div>
                        <p className="text-red-500">{transferErrorMessage}</p>
                        <button onClick={handleTransfer}>重试</button>
                    </div>
                )}
            </div>

            <div>
                <button onClick={handleSendETH} disabled={!address || isConfirmingSend}>
                    {isConfirmingSend ? '发送中...' : '发送ETH'}
                </button>
                {isSendConfirmed && <p className="text-green-500">发送成功!</p>}
                {sendErrorMessage && <p className="text-red-500">{sendErrorMessage}</p>}
            </div>
        </div>
    )
}
