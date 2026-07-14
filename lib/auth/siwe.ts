import type { Address, Hex, PublicClient } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { generateSiweNonce, parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import { mainnetClient, sepoliaClient } from '../viemClient'
import { getAuthSecret } from './secret'
import { sign, verify } from './signedCookie'

export const NONCE_COOKIE_NAME = 'siwe-nonce'
export const NONCE_TTL_SECONDS = 60 * 5

function clientForChain(chainId: number): PublicClient | undefined {
  if (chainId === sepolia.id) return sepoliaClient
  if (chainId === mainnet.id) return mainnetClient
  return undefined
}

export function createNonceCookie(): { nonce: string; cookie: string } {
  const nonce = generateSiweNonce()
  const cookie = sign(NONCE_COOKIE_NAME, { nonce }, NONCE_TTL_SECONDS, getAuthSecret())
  return { nonce, cookie }
}

type VerifySignInResult = { ok: true; address: Address; chainId: number } | { ok: false; reason: string }

export async function verifySignIn(
  message: string,
  signature: Hex,
  nonceCookieValue: string | undefined,
  requestHost: string,
): Promise<VerifySignInResult> {
  const storedNonce = verify<{ nonce: string }>(NONCE_COOKIE_NAME, nonceCookieValue, getAuthSecret())
  if (!storedNonce) {
    return { ok: false, reason: 'nonce 缺失或已过期' }
  }

  const { nonce, domain, address, chainId } = parseSiweMessage(message)
  if (!nonce || !domain || !address || !chainId) {
    return { ok: false, reason: '消息格式不完整' }
  }

  if (nonce !== storedNonce.nonce) {
    return { ok: false, reason: 'nonce 不匹配' }
  }

  if (domain !== requestHost) {
    return { ok: false, reason: 'domain 不匹配' }
  }

  const client = clientForChain(chainId)
  if (!client) {
    return { ok: false, reason: '不支持的链' }
  }

  const isValid = await verifySiweMessage(client, {
    message,
    signature,
    domain: requestHost,
    nonce: storedNonce.nonce,
  })

  if (!isValid) {
    return { ok: false, reason: '签名验证失败' }
  }

  return { ok: true, address, chainId }
}
