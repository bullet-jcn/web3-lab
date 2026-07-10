interface AssetCardProps {
    chainName: string;
    balance: string | null;
    isLoading: boolean;
    error?: string
}

export function AssetCard({ chainName, balance, isLoading, error }: AssetCardProps) {
    return (
        <div className="bg-white shadow-md rounded-lg p-4 flex flex-col items-center justify-center space-y-2">
            <h2 className="text-lg font-semibold">{chainName}</h2>
            {isLoading ? (
                <p>加载中...</p>
            ) : error ? (
                <p className="text-red-500">{error}</p>
            ) : (
                <p>余额: {balance ?? '-'} ETH</p>
            )}
        </div>
    )
}