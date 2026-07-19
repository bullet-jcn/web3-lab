import { describe, expect, it } from 'vitest'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { Address } from 'viem'
import { addToWatchlist, getWatchlist, removeFromWatchlist } from './watchlist'

// AUTH_COOKIE_SECRET is read lazily by getAuthSecret() inside sign()/verify(),
// so it has to be set before any of that code runs.
process.env.AUTH_COOKIE_SECRET = 'test-secret'

function randomAddress(): Address {
  return privateKeyToAccount(generatePrivateKey()).address
}

const OWNER = randomAddress()

// Builds up a watchlist cookie by adding each address in order, going
// through addToWatchlist itself rather than hand-rolling a cookie — that way
// the test doesn't depend on watchlistPurpose()'s private cookie format.
function seedWatchlist(addresses: Address[]): string | undefined {
  let cookie: string | undefined
  for (const address of addresses) {
    const result = addToWatchlist(OWNER, cookie, address)
    if (!result.ok) throw new Error(`failed to seed watchlist: ${result.reason}`)
    cookie = result.cookie
  }
  return cookie
}

describe('getWatchlist', () => {
  it('returns an empty list when there is no cookie yet', () => {
    expect(getWatchlist(OWNER, undefined)).toEqual([])
  })
})

describe('addToWatchlist', () => {
  it('adds a valid address to an empty list', () => {
    const target = randomAddress()
    const result = addToWatchlist(OWNER, undefined, target)
    expect(result).toMatchObject({ ok: true, addresses: [target.toLowerCase()] })
  })

  it('rejects a malformed address', () => {
    // Deliberately bypasses the Address type at compile time to exercise
    // addToWatchlist's runtime isAddress() check.
    const result = addToWatchlist(OWNER, undefined, 'not-an-address' as Address)
    expect(result).toEqual({ ok: false, reason: '地址不合法' })
  })

  it('rejects an address that is already in the list', () => {
    const target = randomAddress()
    const cookie = seedWatchlist([target])
    const result = addToWatchlist(OWNER, cookie, target)
    expect(result).toEqual({ ok: false, reason: '地址已存在' })
  })

  it('rejects adding once the list is already at the 20-address limit', () => {
    const addresses = Array.from({ length: 20 }, randomAddress)
    const cookie = seedWatchlist(addresses)
    const result = addToWatchlist(OWNER, cookie, randomAddress())
    expect(result).toEqual({ ok: false, reason: '最多只能关注 20 个地址' })
  })
})

describe('removeFromWatchlist', () => {
  it('removes an address that is in the list', () => {
    const target = randomAddress()
    const cookie = seedWatchlist([target])
    const result = removeFromWatchlist(OWNER, cookie, target)
    expect(result).toMatchObject({ ok: true, addresses: [] })
  })

  it('rejects removing an address that is not in the list', () => {
    const cookie = seedWatchlist([randomAddress()])
    const result = removeFromWatchlist(OWNER, cookie, randomAddress())
    expect(result).toEqual({ ok: false, reason: '地址不在关注列表中' })
  })
})
