interface AssetCardProps {
    chainName: string;
    balance: string | null;
    isLoading: boolean;
    error?: string
}

export function AssetCard({ chainName, balance, isLoading, error }: AssetCardProps) {
    return (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="text-sm font-semibold">{chainName}</h3>
            {isLoading ? (
                <p className="text-sm text-gray-500 dark:text-neutral-400">加载中...</p>
            ) : error ? (
                <p className="text-sm text-red-500">{error}</p>
            ) : (
                <p className="text-sm">余额: {balance ?? '-'} ETH</p>
            )}
        </div>
    )
}
