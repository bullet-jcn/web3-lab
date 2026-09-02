import type { Address } from 'viem'
import { cookies } from 'next/headers'
import { getAuthSecret } from './secret'
import { sign, verify } from './signedCookie'
import { readBackendStorageMode } from '@/lib/server/storageMode'
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from './constants'

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from './constants'

export interface SessionPayload {
  address: Address
  chainId: number
  userId?: string
  walletId?: string
}

export function createSession(address: Address, chainId: number): string {
  return sign(SESSION_COOKIE_NAME, { address, chainId }, SESSION_TTL_SECONDS, getAuthSecret())
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieValue = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (readBackendStorageMode() === 'postgres') {
    const { getBackendSessionService } = await import('@/lib/server/backendServices')
    const session = await (await getBackendSessionService()).get(cookieValue)
    if (!session) return null
    return {
      address: session.address,
      chainId: session.chainId,
      userId: session.userId,
      walletId: session.walletId,
    }
  }
  return verify<SessionPayload>(SESSION_COOKIE_NAME, cookieValue, getAuthSecret())
}
