'use client'

import { useState } from 'react'
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { mainnet, sepolia } from 'viem/chains'
import { Button } from '@/components/ui/button'
import { truncateAddress } from '@/lib/format'
import { getWalletConnectionErrorMessage } from '@/lib/walletConnection'

interface WalletConnectorSummary {
  id: string
  name: string
  type: string
}

function connectorLabel(connector: WalletConnectorSummary): string {
  if (connector.type === 'walletConnect') return 'WalletConnect'
  if (connector.name === 'Injected') return '浏览器扩展钱包'
  return connector.name
}

function connectorDescription(connector: WalletConnectorSummary): string {
  if (connector.type === 'walletConnect') return '扫描二维码或跳转到兼容的移动钱包。'
  return '使用浏览器中已安装或已注入的钱包。'
}

export function WalletConnectPanel() {
  const {
    address,
    chain,
    chainId,
    connector: activeConnector,
    isConnected,
    isConnecting,
    isReconnecting,
  } = useConnection()
  const { mutateAsync: connectAsync } = useConnect()
  const connectors = useConnectors()
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnect()
  const { mutate: switchChain, error: switchChainError, isPending: isSwitchingChain } = useSwitchChain()
  const [showWalletSelector, setShowWalletSelector] = useState(false)
  const [connectingConnectorUid, setConnectingConnectorUid] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const hasWalletConnect = connectors.some((connector) => connector.type === 'walletConnect')
  const isConnectionBusy = isConnecting || isReconnecting || connectingConnectorUid !== null

  async function connectConnector(connector: (typeof connectors)[number]) {
    if (isConnected || isConnectionBusy) return
    setConnectingConnectorUid(connector.uid)
    setConnectionError(null)
    try {
      await connectAsync({ connector })
      setShowWalletSelector(false)
    } catch (error) {
      setConnectionError(getWalletConnectionErrorMessage(error))
    } finally {
      setConnectingConnectorUid(null)
    }
  }

  function handleDisconnect() {
    setConnectionError(null)
    setShowWalletSelector(false)
    disconnect()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2" aria-live="polite">
        {isReconnecting ? (
          <p className="text-sm text-muted-foreground">正在恢复钱包连接，不会在恢复完成前启用写操作…</p>
        ) : isConnected && address ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
                {isDisconnecting ? '断开中…' : '断开连接'}
              </Button>
              <p className="font-mono text-sm" title={address}>{truncateAddress(address)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              已连接：{activeConnector ? connectorLabel(activeConnector) : '未知钱包'}
              {chain ? ` · ${chain.name} (${chain.id})` : chainId ? ` · chainId ${chainId}` : ''}
            </p>
          </div>
        ) : isConnecting ? (
          <Button disabled>连接中…</Button>
        ) : (
          <Button
            type="button"
            aria-expanded={showWalletSelector}
            aria-controls="wallet-selector"
            onClick={() => {
              setConnectionError(null)
              setShowWalletSelector((current) => !current)
            }}
          >选择钱包</Button>
        )}
      </div>

      {!isConnected && !isReconnecting && showWalletSelector && (
        <div id="wallet-selector" className="space-y-2 rounded-md border border-border p-3" role="region" aria-label="钱包选择">
          <div>
            <p className="text-sm font-medium">选择连接方式</p>
            <p className="text-xs text-muted-foreground">连接只授权读取账户；每笔交易仍需在钱包中单独确认。</p>
          </div>
          {connectors.map((connector) => {
            const isThisConnectorConnecting = connectingConnectorUid === connector.uid
            const label = connectorLabel(connector)
            return (
              <div key={connector.uid} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 p-2">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{connectorDescription(connector)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`连接 ${label}`}
                  onClick={() => { void connectConnector(connector) }}
                  disabled={isConnectionBusy}
                >{isThisConnectorConnecting ? '连接中…' : '连接'}</Button>
              </div>
            )
          })}
          {!hasWalletConnect && (
            <div className="space-y-1 rounded-md bg-muted/50 p-2">
              <Button type="button" variant="outline" disabled>WalletConnect（未配置）</Button>
              <p className="text-xs text-muted-foreground">
                配置 NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID 并重新构建后启用。
              </p>
            </div>
          )}
          {connectors.length === 0 && <p className="text-sm text-destructive">当前没有可用的钱包连接器。</p>}
        </div>
      )}

      {connectionError && <p className="text-sm text-destructive" role="alert">{connectionError}</p>}

      {isConnected && !isReconnecting && (
        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-neutral-800">
          <p className="text-xs text-muted-foreground">切换网络会请求当前钱包确认，不会自动发起交易。</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => switchChain({ chainId: mainnet.id })}
              disabled={isSwitchingChain || chainId === mainnet.id}
            >{isSwitchingChain ? '切换中…' : chainId === mainnet.id ? '当前：Ethereum' : '切换到 Ethereum'}</Button>
            <Button
              variant="ghost"
              onClick={() => switchChain({ chainId: sepolia.id })}
              disabled={isSwitchingChain || chainId === sepolia.id}
            >{isSwitchingChain ? '切换中…' : chainId === sepolia.id ? '当前：Sepolia' : '切换到 Sepolia'}</Button>
          </div>
          {switchChainError && (
            <p className="text-sm text-destructive" role="alert">切换网络失败，请在钱包中确认目标网络后重试</p>
          )}
        </div>
      )}
    </div>
  )
}
