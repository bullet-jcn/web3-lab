import { describe, expect, it } from 'vitest'
import { createPublicClient, http, type PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { createNonceCookie, verifySignIn } from './siwe'

// AUTH_COOKIE_SECRET is read lazily by getAuthSecret() inside sign()/verify(),
// so it has to be set before any of that code runs.
process.env.AUTH_COOKIE_SECRET = 'test-secret'

const DOMAIN = 'localhost:3000'

// Points at a port nothing listens on, with retries disabled, so any real
// network call fails immediately. verifySiweMessage still validates a plain
// EOA signature correctly because it falls back to local ECDSA recovery
// whenever the on-chain (ERC-6492) check can't complete — confirmed by
// reading viem's verifyHash source, not assumed.
const offlineClient: PublicClient = createPublicClient({
  chain: sepolia,
  transport: http('http://127.0.0.1:1', { retryCount: 0 }),
})

async function buildSignedMessage(nonce: string) {
  const account = privateKeyToAccount(generatePrivateKey())
  const message = createSiweMessage({
    address: account.address,
    chainId: sepolia.id,
    domain: DOMAIN,
    nonce,
    uri: `http://${DOMAIN}`,
    version: '1',
  })
  const signature = await account.signMessage({ message })
  return { account, message, signature }
}

describe('verifySignIn', () => {
  it('accepts a correctly signed message with a matching nonce', async () => {
    const { nonce, cookie } = createNonceCookie()
    const { account, message, signature } = await buildSignedMessage(nonce)

    const result = await verifySignIn(message, signature, cookie, DOMAIN, () => offlineClient)

    expect(result).toEqual({ ok: true, address: account.address, chainId: sepolia.id })
  })

  it('rejects when the nonce cookie is missing', async () => {
    const { nonce } = createNonceCookie()
    const { message, signature } = await buildSignedMessage(nonce)

    const result = await verifySignIn(message, signature, undefined, DOMAIN, () => offlineClient)

    expect(result).toEqual({ ok: false, reason: 'nonce 缺失或已过期' })
  })

  it('rejects when the message nonce does not match the cookie nonce', async () => {
    const { cookie } = createNonceCookie()
    const { message, signature } = await buildSignedMessage('differentnonce1')

    const result = await verifySignIn(message, signature, cookie, DOMAIN, () => offlineClient)

    expect(result).toEqual({ ok: false, reason: 'nonce 不匹配' })
  })

  it('rejects when the domain does not match', async () => {
    const { nonce, cookie } = createNonceCookie()
    const { message, signature } = await buildSignedMessage(nonce)

    const result = await verifySignIn(message, signature, cookie, 'evil.example', () => offlineClient)

    expect(result).toEqual({ ok: false, reason: 'domain 不匹配' })
  })

  it('rejects a tampered signature', async () => {
    const { nonce, cookie } = createNonceCookie()
    const { message, signature } = await buildSignedMessage(nonce)
    const flippedChar = signature[2] === 'a' ? 'b' : 'a'
    const tampered = (signature.slice(0, 2) + flippedChar + signature.slice(3)) as `0x${string}`

    const result = await verifySignIn(message, tampered, cookie, DOMAIN, () => offlineClient)

    expect(result).toEqual({ ok: false, reason: '签名验证失败' })
  })

  it('rejects a chain that has no configured client', async () => {
    const { nonce, cookie } = createNonceCookie()
    const account = privateKeyToAccount(generatePrivateKey())
    const message = createSiweMessage({
      address: account.address,
      chainId: 999999,
      domain: DOMAIN,
      nonce,
      uri: `http://${DOMAIN}`,
      version: '1',
    })
    const signature = await account.signMessage({ message })

    const result = await verifySignIn(message, signature, cookie, DOMAIN, () => undefined)

    expect(result).toEqual({ ok: false, reason: '不支持的链' })
  })
})
