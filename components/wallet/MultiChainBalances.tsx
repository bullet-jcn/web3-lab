'use client'

import { useMultiChainBalance } from "@/lib/hooks/useMultiChainBalance"
import { AssetCard } from "../ui/AssetCard"
import { useConnection } from "wagmi"

export function MultiChainBalances() {
    const { address } = useConnection()
    const chainBalances = useMultiChainBalance(address)

    if (!address) {
        return <p className="text-sm text-gray-500 dark:text-neutral-400">连接钱包后查看多链余额</p>
    }

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {chainBalances.map((chain) => (
                <AssetCard
                    key={chain.id}
                    chainName={chain.name}
                    balance={chain.balance}
                    isLoading={chain.isLoading}
                    error={chain.error ?? undefined}
                />
            ))}
        </div>
    )
}
