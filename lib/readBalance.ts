import { useConnection } from 'wagmi'
import { baseSepoliaClient, sepoliaClient } from './viemClient'
import { formatEther, isAddress } from 'viem'
import { useEffect, useState } from 'react'

export async function readSepoliaBalance(address: string) {
  if (!isAddress(address)) {
    throw new Error('这不是一个合法的以太坊地址')
  }

  try {
    const balance = await sepoliaClient.getBalance({ address })
    return formatEther(balance)
  } catch (error) {
    console.error('读取余额失败:', error)
    throw error
  }
}

export async function readBaseBalance(address: string) {
  if (!isAddress(address)) {
    throw new Error('这不是一个合法的以太坊地址')
  }

  try {
    const balance = await baseSepoliaClient.getBalance({ address })
    return formatEther(balance)
  } catch (error) {
    console.error('读取余额失败:', error)
    throw error
  }
}

export function useMultiChainBalance() {
  const { address } = useConnection()

  const [sepoliaBalance, setSepoliaBalance] = useState<string | null>(null)
  const [baseBalance, setBaseBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ sepolia?: string; base?: string }>({})

  useEffect(() => {
    if (!address) return

    async function fetchBalances(addr: string) {
      setLoading(true)
      setError({})

      const results = await Promise.allSettled([
        readSepoliaBalance(addr),
        readBaseBalance(addr)
      ])

      const [sepoliaResult, baseResult] = results

      if (sepoliaResult.status === 'fulfilled') {
        setSepoliaBalance(sepoliaResult.value)
      } else {
        setError(prev => ({ ...prev, sepolia: '读取 Sepolia 余额失败' }))
      }

      if (baseResult.status === 'fulfilled') {
        setBaseBalance(baseResult.value)
      } else {
        setError(prev => ({ ...prev, base: '读取 Base 余额失败' }))
      }

      setLoading(false)
    }

    fetchBalances(address)
  }, [address])

  return { sepoliaBalance, baseBalance, loading, error }
}