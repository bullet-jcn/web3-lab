import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "./useSession"
import { Address } from "viem"

export function useWatchlist() {
    const queryClient = useQueryClient()
    const session = useSession()
    const watchlistQuery = useQuery({
        queryKey: ['watchlist'],
        queryFn: async () => {
            const res = await fetch('/api/watchlist', { method: 'GET' })
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
            queryClient.setQueryData(['watchlist'], data)
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
            queryClient.setQueryData(['watchlist'], data)
        },
    })

    return {
        addresses: watchlistQuery.data?.addresses ?? [],
        isLoading: watchlistQuery.isLoading,
        addAddress: addMutation.mutate,
        removeAddress: removeMutation.mutate,
    }
}