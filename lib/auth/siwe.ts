import type { Address, Hex, PublicClient } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { generateSiweNonce, parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import { mainnetClient, sepoliaClient } from '../viemClient'
import { getAuthSecret } from './secret'
import { sign, verify } from './signedCookie'
import { NONCE_COOKIE_NAME, NONCE_TTL_SECONDS } from './constants'

export { NONCE_COOKIE_NAME, NONCE_TTL_SECONDS } from './constants'

export function clientForChain(chainId: number): PublicClient | undefined {
  if (chainId === sepolia.id) return sepoliaClient
  if (chainId === mainnet.id) return mainnetClient
  return undefined
}

export function createNonceCookie(): { nonce: string; cookie: string } {
  const nonce = generateSiweNonce()
  const cookie = sign(NONCE_COOKIE_NAME, { nonce }, NONCE_TTL_SECONDS, getAuthSecret())
  return { nonce, cookie }
}

export function createSiweNonce(): string {
  return generateSiweNonce()
}

type VerifySignInResult = { ok: true; address: Address; chainId: number } | { ok: false; reason: string }

export async function verifySignIn(
  message: string,
  signature: Hex,
  nonceCookieValue: string | undefined,
  expectedOrigin: string,
  resolveClient: (chainId: number) => PublicClient | undefined = clientForChain,
): Promise<VerifySignInResult> {
  const storedNonce = verify<{ nonce: string }>(NONCE_COOKIE_NAME, nonceCookieValue, getAuthSecret())
  return verifySignInWithNonce(
    message,
    signature,
    storedNonce?.nonce,
    expectedOrigin,
    resolveClient,
  )
}

export async function verifySignInWithNonce(
  message: string,
  signature: Hex,
  storedNonce: string | undefined,
  expectedOrigin: string,
  resolveClient: (chainId: number) => PublicClient | undefined = clientForChain,
): Promise<VerifySignInResult> {
  if (!storedNonce) {
    return { ok: false, reason: 'nonce 缺失或已过期' }
  }

  const { nonce, domain, address, chainId, uri, version, scheme } = parseSiweMessage(message)
  if (!nonce || !domain || !address || !chainId || !uri || !version) {
    return { ok: false, reason: '消息格式不完整' }
  }

  const originUrl = new URL(expectedOrigin)
  if (version !== '1') {
    return { ok: false, reason: 'SIWE version 不受支持' }
  }

  if (uri !== originUrl.origin || (scheme && scheme !== originUrl.protocol.slice(0, -1))) {
    return { ok: false, reason: 'uri 不匹配' }
  }

  if (nonce !== storedNonce) {
    return { ok: false, reason: 'nonce 不匹配' }
  }

  if (domain !== originUrl.host) {
    return { ok: false, reason: 'domain 不匹配' }
  }

  const client = resolveClient(chainId)
  if (!client) {
    return { ok: false, reason: '不支持的链' }
  }

  const isValid = await verifySiweMessage(client, {
    message,
    signature,
    domain: originUrl.host,
    nonce: storedNonce,
  })

  if (!isValid) {
    return { ok: false, reason: '签名验证失败' }
  }

  return { ok: true, address, chainId }
}
