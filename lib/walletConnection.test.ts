import { describe, expect, it } from 'vitest'
import {
  getWalletConnectionErrorMessage,
  normalizeWalletConnectProjectId,
} from './walletConnection'

describe('normalizeWalletConnectProjectId', () => {
  it('accepts a configured public project ID', () => {
    expect(normalizeWalletConnectProjectId('  project-123  ')).toBe('project-123')
  })

  it.each([undefined, '', '   ', 'your-walletconnect-project-id'])(
    'rejects missing or placeholder values %#',
    (value) => expect(normalizeWalletConnectProjectId(value)).toBeNull(),
  )
})

describe('getWalletConnectionErrorMessage', () => {
  it('distinguishes user rejection from a generic failure', () => {
    expect(getWalletConnectionErrorMessage(new Error('User rejected the request'))).toBe('你取消了钱包连接')
  })

  it('finds a rejection in a nested cause', () => {
    expect(getWalletConnectionErrorMessage(new Error('wrapper', {
      cause: new Error('User denied request signature'),
    }))).toBe('你取消了钱包连接')
  })

  it('distinguishes missing injected providers and WalletConnect failures', () => {
    expect(getWalletConnectionErrorMessage(new Error('provider not found'))).toBe(
      '未检测到所选钱包，请先安装或打开钱包后重试',
    )
    expect(getWalletConnectionErrorMessage(new Error('WalletConnect pairing failed'))).toBe(
      'WalletConnect 会话建立失败，请确认移动钱包和网络后重试',
    )
  })

  it('does not expose unknown upstream details', () => {
    expect(getWalletConnectionErrorMessage(new Error('private relay endpoint leaked'))).toBe('连接钱包失败，请重试')
  })
})
