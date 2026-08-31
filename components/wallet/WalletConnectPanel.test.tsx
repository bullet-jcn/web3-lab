import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mainnet, sepolia } from 'viem/chains'
import { WalletConnectPanel } from './WalletConnectPanel'

const ACCOUNT = '0x0000000000000000000000000000000000000001'

const mocks = vi.hoisted(() => ({
  connectors: [
    { uid: 'injected-uid', id: 'injected', name: 'Injected', type: 'injected' },
    { uid: 'walletconnect-uid', id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' },
  ],
  connection: {
    address: undefined as string | undefined,
    chain: undefined as { id: number; name: string } | undefined,
    chainId: undefined as number | undefined,
    connector: undefined as { uid: string; id: string; name: string; type: string } | undefined,
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
  },
  connectAsync: vi.fn(),
  disconnect: vi.fn(),
  switchChain: vi.fn(),
  isDisconnecting: false,
  isSwitchingChain: false,
  switchChainError: null as Error | null,
}))

vi.mock('wagmi', () => ({
  useConnection: () => mocks.connection,
  useConnect: () => ({ mutateAsync: mocks.connectAsync }),
  useConnectors: () => mocks.connectors,
  useDisconnect: () => ({ mutate: mocks.disconnect, isPending: mocks.isDisconnecting }),
  useSwitchChain: () => ({
    mutate: mocks.switchChain,
    error: mocks.switchChainError,
    isPending: mocks.isSwitchingChain,
  }),
}))

function setDisconnected() {
  Object.assign(mocks.connection, {
    address: undefined,
    chain: undefined,
    chainId: undefined,
    connector: undefined,
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
  })
}

function setConnected(connector = mocks.connectors[1]) {
  Object.assign(mocks.connection, {
    address: ACCOUNT,
    chain: { id: sepolia.id, name: 'Sepolia' },
    chainId: sepolia.id,
    connector,
    isConnected: true,
    isConnecting: false,
    isReconnecting: false,
  })
}

describe('WalletConnectPanel', () => {
  beforeEach(() => {
    setDisconnected()
    mocks.connectors.splice(0, mocks.connectors.length,
      { uid: 'injected-uid', id: 'injected', name: 'Injected', type: 'injected' },
      { uid: 'walletconnect-uid', id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' },
    )
    mocks.connectAsync.mockReset().mockResolvedValue({ accounts: [ACCOUNT], chainId: sepolia.id })
    mocks.disconnect.mockReset()
    mocks.switchChain.mockReset()
    mocks.isDisconnecting = false
    mocks.isSwitchingChain = false
    mocks.switchChainError = null
  })

  it('requires the user to select a concrete connector', async () => {
    render(<WalletConnectPanel />)

    fireEvent.click(screen.getByRole('button', { name: '选择钱包' }))
    expect(screen.getByRole('region', { name: '钱包选择' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '连接 浏览器扩展钱包' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '连接 WalletConnect' }))

    await waitFor(() => expect(mocks.connectAsync).toHaveBeenCalledWith({
      connector: expect.objectContaining({ uid: 'walletconnect-uid', type: 'walletConnect' }),
    }))
    expect(screen.queryByText('连接成功')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择钱包' })).toBeInTheDocument()
  })

  it('shows WalletConnect as unavailable when no configured connector exists', () => {
    mocks.connectors.splice(1)
    render(<WalletConnectPanel />)

    fireEvent.click(screen.getByRole('button', { name: '选择钱包' }))
    expect(screen.getByRole('button', { name: 'WalletConnect（未配置）' })).toBeDisabled()
    expect(screen.getByText(/NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID/)).toBeInTheDocument()
  })

  it('shows a distinct user-rejection state without claiming connection', async () => {
    mocks.connectAsync.mockRejectedValue(new Error('User rejected the request'))
    render(<WalletConnectPanel />)
    fireEvent.click(screen.getByRole('button', { name: '选择钱包' }))
    fireEvent.click(screen.getByRole('button', { name: '连接 WalletConnect' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('你取消了钱包连接')
    expect(screen.queryByText(/已连接/)).not.toBeInTheDocument()
  })

  it('renders connected identity from Wagmi state and disconnects explicitly', () => {
    setConnected()
    render(<WalletConnectPanel />)

    expect(screen.getByText(`已连接：WalletConnect · Sepolia (${sepolia.id})`)).toBeInTheDocument()
    expect(screen.getByTitle(ACCOUNT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '当前：Sepolia' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '断开连接' }))
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
  })

  it('blocks wallet choices while Wagmi is restoring a prior connection', () => {
    Object.assign(mocks.connection, { isReconnecting: true, isConnected: true, address: ACCOUNT })
    render(<WalletConnectPanel />)

    expect(screen.getByText('正在恢复钱包连接，不会在恢复完成前启用写操作…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择钱包' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '断开连接' })).not.toBeInTheDocument()
  })

  it('requests the selected chain and does not expose raw switch errors', () => {
    setConnected(mocks.connectors[0])
    mocks.switchChainError = new Error('private provider endpoint details')
    render(<WalletConnectPanel />)

    fireEvent.click(screen.getByRole('button', { name: '切换到 Ethereum' }))
    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: mainnet.id })
    expect(screen.getByRole('alert')).toHaveTextContent('切换网络失败，请在钱包中确认目标网络后重试')
    expect(screen.queryByText(/private provider endpoint details/)).not.toBeInTheDocument()
  })
})
