import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "./useSession"
import { Address } from "viem"

export function useWatchlist() {
    const queryClient = useQueryClient()
    const session = useSession()
    const watchlistKey = ['watchlist', session.data?.address, session.data?.chainId] as const
    const watchlistQuery = useQuery({
        queryKey: watchlistKey,
        queryFn: async () => {
            const res = await fetch('/api/watchlist', { method: 'GET' })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? '关注列表暂时不可用')
            }
            return res.json()
        },
        enabled: !!session.data
    })
    const addMutation = useMutation({
        mutationFn: async (targetAddress: Address) => {
            const res = await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: targetAddress }),
            })
            if (!res.ok) {
                const { error } = await res.json()
                throw new Error(error ?? '操作失败')
            }
            return res.json()
        },
        onSuccess: (data) => {
            queryClient.setQueryData(watchlistKey, data)
        },
    })

    const removeMutation = useMutation({
        mutationFn: async (targetAddress: Address) => {
            const res = await fetch('/api/watchlist', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: targetAddress }),
            })
            if (!res.ok) {
                const { error } = await res.json()
                throw new Error(error ?? '操作失败')
            }
            return res.json()
        },
        onSuccess: (data) => {
            queryClient.setQueryData(watchlistKey, data)
        },
    })

    return {
        addresses: session.data ? (watchlistQuery.data?.addresses ?? []) : [],
        isLoading: watchlistQuery.isLoading,
        addAddress: addMutation.mutate,
        isAdding: addMutation.isPending,
        addError: addMutation.error,
        removeAddress: removeMutation.mutate,
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,
    }
}
