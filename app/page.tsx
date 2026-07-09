'use client'
import { useState } from 'react'
import { readBalance } from '@/lib/readBalance'
import { useAccount, useConnect, useDisconnect, useReadContract, useSendTransaction, useSimulateContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { erc20Abi, parseEther } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

function Modal({ address, onClose }: { address: `0x${string}` | undefined; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded">
        <p>连接成功</p>
        {address && <p className="font-mono text-sm">{address}</p>}
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}

function getErrorMessage(error: Error | null): string | null {
  if (!error) return null

  const message = error.message

  if (message.includes('User rejected') || message.includes('User denied')) {
    return '你取消了这笔交易'
  }
  if (message.includes('insufficient funds')) {
    return 'gas不足，请到水龙头领取一些测试ETH'
  }
  if (message.includes('reverted')) {
    return '合约拒绝了这个操作，请检查参数或余额'
  }
  if (message.includes('gas limit too high') || message.includes('RPC submit')) {
    return 'Gas设置异常，请刷新页面重试'
  }

  return '转账失败，请重试'
}

export default function Home() {
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const { writeContract, data: hash, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const { data: tokenBalance } = useReadContract({
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,  // 只有 address 存在时，才真正发起这个查询
    },
  })

  const { data: simulateData, error: simulateError } = useSimulateContract({
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
    abi: erc20Abi,
    functionName: 'transfer',
    args: address ? ['0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b', BigInt(1)] : undefined,
    query: { enabled: !!address },
  })

  const { switchChain, error: switchChainError, isPending: isSwitchingChain } = useSwitchChain()

  async function handleCheck() {
    console.log('tokenBalance', tokenBalance)
    setLoading(true)
    setError(null)
    try {
      const result = await readBalance(address || '')
      setBalance(result)
    } catch (err) {

      setError('查询失败，请检查地址')
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    if (isConnected) {
      setShowModal(true)
      return
    }
    try {
      setLoading(true)
      setError(null)
      await connect({ connector: connectors[0] })
      setLoading(false)
      setShowModal(true)
    } catch (err) {

      console.error('连接失败:', err)
      setError('连接钱包失败，请重试')
    }
  }

  function handleDisconnect() {
    setLoading(true)
    setError(null)
    try {
      disconnect()
    } catch (err) {
      console.error('断开连接失败:', err)
      setError('断开连接失败，请重试')
    } finally {
      setLoading(false)
      disconnect()
      setShowModal(false)
      setBalance(null)  // 断开连接后清空余额显示
    }
  }

  function handleTransfer() {
    if (!address) {
      setError('请先连接钱包')
      return
    }
    if (simulateError) {
      setError(getErrorMessage(simulateError))
      return
    }
    setLoading(true)
    setError(null)
    writeContract({
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
      abi: erc20Abi,
      functionName: 'transfer',
      args: ['0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b', BigInt(1)], // 替换为实际的接收地址和转账金额
    })
  }

  const { sendTransaction, data: sendHash, error: sendError } = useSendTransaction()
  const { isLoading: isSending, isSuccess: sendSuccess } = useWaitForTransactionReceipt({ hash: sendHash })

  function handleSendETH() {
    sendTransaction({
      to: '0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b',
      value: parseEther('0.0001'), // 发送一点点真实的SepoliaETH
    })
  }



  return (
    <div className="p-6 space-y-4">
      <div className="space-x-2">
        <button onClick={handleConnect}>连接钱包</button>
        <button onClick={handleCheck}>查询余额</button>
        {
          isConfirming ? (
            <button disabled>确认中...</button>
          ) : (
            <button onClick={handleTransfer} disabled={!!simulateError}>转账</button>
          )
        }
        {
          isSending ? (
            <button disabled>发送中...</button>
          ) : (
            <button onClick={handleSendETH}>发送ETH</button>
          )
        }
        {simulateError && <p className="text-orange-500">预计会失败，暂时无法转账</p>}
        {writeError && <p className="text-red-500">{getErrorMessage(writeError)}</p>}
        {isConfirmed && <p className="text-green-500">转账成功!</p>}
        {writeError && (
          <div>
            <p className="text-red-500">{getErrorMessage(writeError)}</p>
            <button onClick={handleTransfer}>重试</button>
          </div>
        )}
        <button onClick={() => switchChain({ chainId: mainnet.id })} disabled={isSwitchingChain}>
          {isSwitchingChain ? '切换中...' : '切到主网'}
        </button>
        <button onClick={() => switchChain({ chainId: sepolia.id })} disabled={isSwitchingChain}>
          {isSwitchingChain ? '切换中...' : '切到Sepolia'}
        </button>
        {switchChainError && <p className="text-red-500">切换网络失败: {switchChainError.message}</p>}
      </div>
      <div>
        <p>
          {tokenBalance !== undefined ? `USDC余额(原始): ${tokenBalance}` : '未查询到余额'}
        </p>
      </div>

      {isConnected && (
        <div>
          <p>地址: {address}</p>
          <button onClick={handleDisconnect}>断开</button>
        </div>
      )}

      {loading && <p>加载中...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {balance && <p>余额: {balance} ETH</p>}
      {showModal && <Modal address={address} onClose={() => setShowModal(false)} />}
    </div>
  )
}
