import type { Address } from 'viem'
import { cookies } from 'next/headers'
import { getAuthSecret } from './secret'
import { sign, verify } from './signedCookie'

export const SESSION_COOKIE_NAME = 'session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

interface SessionPayload {
  address: Address
  chainId: number
}

export function createSession(address: Address, chainId: number): string {
  return sign(SESSION_COOKIE_NAME, { address, chainId }, SESSION_TTL_SECONDS, getAuthSecret())
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieValue = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return verify<SessionPayload>(SESSION_COOKIE_NAME, cookieValue, getAuthSecret())
}
