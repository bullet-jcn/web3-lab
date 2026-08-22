import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { resolveWalletSessionStatus } from './walletSession'

const SESSION_ADDRESS = '0x1111111111111111111111111111111111111111' as Address
const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222' as Address

describe('resolveWalletSessionStatus', () => {
  it('reports signed-out without a session', () => {
    expect(resolveWalletSessionStatus(undefined, SESSION_ADDRESS)).toBe('signed-out')
  })

  it('reports wallet-disconnected when a session exists without a connected wallet', () => {
    expect(resolveWalletSessionStatus(SESSION_ADDRESS, undefined)).toBe('wallet-disconnected')
  })

  it('matches addresses case-insensitively', () => {
    expect(resolveWalletSessionStatus(SESSION_ADDRESS, SESSION_ADDRESS.toUpperCase() as Address)).toBe('matched')
  })

  it('reports account-mismatch for a different connected wallet', () => {
    expect(resolveWalletSessionStatus(SESSION_ADDRESS, OTHER_ADDRESS)).toBe('account-mismatch')
  })
})
