import type { Address } from 'viem'
import { isAddress } from 'viem'
import { getAuthSecret } from './secret'
import { sign, verify } from './signedCookie'

const MAX_WATCHLIST_SIZE = 20
const WATCHLIST_TTL_SECONDS = 60 * 60 * 24 * 90 // outlives a single session, survives logout/login

function watchlistPurpose(ownerAddress: Address): string {
  return `watchlist:${ownerAddress.toLowerCase()}`
}

interface WatchlistPayload {
  addresses: Address[]
}

export function getWatchlist(ownerAddress: Address, cookieValue: string | undefined): Address[] {
  const stored = verify<WatchlistPayload>(watchlistPurpose(ownerAddress), cookieValue, getAuthSecret())
  return stored?.addresses ?? []
}

type WatchlistMutationResult = { ok: true; addresses: Address[]; cookie: string } | { ok: false; reason: string }

function persist(ownerAddress: Address, addresses: Address[]): WatchlistMutationResult {
  const payload: WatchlistPayload = { addresses }
  const cookie = sign(watchlistPurpose(ownerAddress), payload, WATCHLIST_TTL_SECONDS, getAuthSecret())
  return { ok: true, addresses, cookie }
}

export function addToWatchlist(
  ownerAddress: Address,
  cookieValue: string | undefined,
  newAddress: Address,
): WatchlistMutationResult {
  if (!isAddress(newAddress)) {
    return { ok: false, reason: '地址不合法' }
  }

  const current = getWatchlist(ownerAddress, cookieValue)
  const normalized = newAddress.toLowerCase() as Address

  if (current.some((address) => address.toLowerCase() === normalized)) {
    return { ok: false, reason: '地址已存在' }
  }

  if (current.length >= MAX_WATCHLIST_SIZE) {
    return { ok: false, reason: `最多只能关注 ${MAX_WATCHLIST_SIZE} 个地址` }
  }

  return persist(ownerAddress, [...current, normalized])
}

export function removeFromWatchlist(
  ownerAddress: Address,
  cookieValue: string | undefined,
  addressToRemove: Address,
): WatchlistMutationResult {
  const current = getWatchlist(ownerAddress, cookieValue)
  const normalized = addressToRemove.toLowerCase()
  const updated = current.filter((address) => address.toLowerCase() !== normalized)

  if (updated.length === current.length) {
    return { ok: false, reason: '地址不在关注列表中' }
  }

  return persist(ownerAddress, updated)
}
