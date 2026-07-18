'use client'

import { useState } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { Modal } from "../ui/Modal";
import { mainnet, sepolia } from "viem/chains";

export function WalletConnectPanel() {
    const { address, isConnected } = useConnection()
    const { mutateAsync: connectAsync } = useConnect()
    const connectors = useConnectors()
    const { mutate: disconnect } = useDisconnect()
    const { mutate: switchChain, error: switchChainError, isPending: isSwitchingChain } = useSwitchChain()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)

    async function handleConnect() {
        if (isConnected) {
            return
        }
        try {
            setLoading(true)
            setError(null)
            // 目前只配置了一个 connector（injected），先固定用第一个；以后接入多个
            // 钱包来源时，这里要换成让用户选择具体 connector。
            await connectAsync({ connector: connectors[0] })
            setShowModal(true)
        } catch (err) {
            console.error('连接失败:', err)
            setError('连接钱包失败，请重试')
        } finally {
            setLoading(false)
        }
    }

    function handleDisconnect() {
        setError(null)
        disconnect()
        setShowModal(false)
    }

    return (
        <div>
            {
                isConnected ? (
                    <button className="text-red-500" onClick={handleDisconnect}>断开连接</button>
                ) : (
                    <button onClick={handleConnect} disabled={loading}>
                        {loading ? '连接中...' : '连接钱包'}
                    </button>
                )
            }
            {error && <p className="text-red-500">{error}</p>}
            {isConnected && address && <p className="font-mono text-sm">已连接: {address}</p>}

            {isConnected && (
                <>
                    <button onClick={() => switchChain({ chainId: mainnet.id })} disabled={isSwitchingChain}>
                        {isSwitchingChain ? '切换中...' : '切到主网'}
                    </button>
                    <button onClick={() => switchChain({ chainId: sepolia.id })} disabled={isSwitchingChain}>
                        {isSwitchingChain ? '切换中...' : '切到Sepolia'}
                    </button>
                    {switchChainError && <p className="text-red-500">切换网络失败: {switchChainError.message}</p>}
                </>
            )}
            {showModal && <Modal onClose={() => setShowModal(false)}><p className="font-mono text-sm">{address}</p></Modal>}
        </div>
    )
}
