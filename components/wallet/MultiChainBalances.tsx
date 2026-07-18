'use client'

import { useMultiChainBalance } from "@/lib/hooks/useMultiChainBalance"
import { AssetCard } from "../ui/AssetCard"
import { useConnection } from "wagmi"

export function MultiChainBalances() {
    const { address } = useConnection()
    const chainBalances = useMultiChainBalance(address)

    if (!address) {
        return <p>连接钱包后查看多链余额</p>
    }

    return (
        <div>
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