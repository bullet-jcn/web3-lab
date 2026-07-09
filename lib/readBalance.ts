import { publicClient } from './viemClient'
import { formatEther, isAddress } from 'viem'

export async function readBalance(address: string) {
  if (!isAddress(address)) {
    throw new Error('这不是一个合法的以太坊地址')
  }

  try {
    const balance = await publicClient.getBalance({ address })
    return formatEther(balance)
  } catch (error) {
    console.error('读取余额失败:', error)
    throw error
  }
}