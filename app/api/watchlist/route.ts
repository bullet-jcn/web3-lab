import { isAddress, type Address } from 'viem'
import { getSession } from '@/lib/auth/session'
import { enforceSameOrigin } from '@/lib/auth/origin'
import { readJsonBody } from '@/lib/http/json'
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  WATCHLIST_COOKIE_NAME,
  WATCHLIST_TTL_SECONDS,
} from '@/lib/auth/watchlist'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getBackendWatchlistRepository } from '@/lib/server/backendServices'
import { readBackendStorageMode } from '@/lib/server/storageMode'
import { observeRoute } from '@/lib/server/observability/route'

const MAX_WATCHLIST_SIZE = 20

function watchlistCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: WATCHLIST_TTL_SECONDS,
    path: '/api',
  }
}

async function readAddress(request: Request): Promise<{ address: Address } | Response> {
  const parsedBody = await readJsonBody(request, 1024)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.value
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'address 缺失或格式不对' }, { status: 400 })
  }
  const { address } = body as Record<string, unknown>
  if (typeof address !== 'string' || !isAddress(address)) {
    return NextResponse.json({ error: 'address 缺失或格式不对' }, { status: 400 })
  }
  return { address: address as Address }
}

async function readWatchlist(): Promise<Response> {
  let session
  try {
    session = await getSession()
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 })
  }
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  if (readBackendStorageMode() === 'postgres') {
    if (!session.userId) {
      return NextResponse.json({ error: 'Session 数据不完整' }, { status: 500 })
    }
    try {
      const entries = await (await getBackendWatchlistRepository()).list(
        session.userId,
        session.chainId,
      )
      return NextResponse.json({ addresses: entries.map((entry) => entry.address) })
    } catch {
      return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 })
    }
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(WATCHLIST_COOKIE_NAME)?.value
  const addresses = getWatchlist(session.address, cookieValue)
  return NextResponse.json({ addresses })
}

async function addWatchlistEntry(request: Request): Promise<Response> {
  const originError = enforceSameOrigin(request)
  if (originError) return originError

  let session
  try {
    session = await getSession()
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 })
  }
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await readAddress(request)
  if (body instanceof Response) return body
  const { address } = body

  if (readBackendStorageMode() === 'postgres') {
    if (!session.userId) {
      return NextResponse.json({ error: 'Session 数据不完整' }, { status: 500 })
    }
    try {
      const repository = await getBackendWatchlistRepository()
      const mutation = await repository.addWithLimit(
        session.userId,
        session.chainId,
        address,
        null,
        MAX_WATCHLIST_SIZE,
      )
      if (mutation.status === 'duplicate') {
        return NextResponse.json({ error: '地址已存在' }, { status: 400 })
      }
      if (mutation.status === 'full') {
        return NextResponse.json({ error: `最多只能关注 ${MAX_WATCHLIST_SIZE} 个地址` }, { status: 400 })
      }
      const entries = await repository.list(session.userId, session.chainId)
      return NextResponse.json({ addresses: entries.map((entry) => entry.address) })
    } catch {
      return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 })
    }
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(WATCHLIST_COOKIE_NAME)?.value
  const result = addToWatchlist(session.address, cookieValue, address)

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  cookieStore.set(WATCHLIST_COOKIE_NAME, result.cookie, watchlistCookieOptions())
  return NextResponse.json({ addresses: result.addresses })
}

async function removeWatchlistEntry(request: Request): Promise<Response> {
  const originError = enforceSameOrigin(request)
  if (originError) return originError

  let session
  try {
    session = await getSession()
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 })
  }
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await readAddress(request)
  if (body instanceof Response) return body
  const { address } = body

  if (readBackendStorageMode() === 'postgres') {
    if (!session.userId) {
      return NextResponse.json({ error: 'Session 数据不完整' }, { status: 500 })
    }
    try {
      const repository = await getBackendWatchlistRepository()
      const removed = await repository.remove(session.userId, session.chainId, address)
      if (!removed) {
        return NextResponse.json({ error: '地址不在关注列表中' }, { status: 400 })
      }
      const entries = await repository.list(session.userId, session.chainId)
      return NextResponse.json({ addresses: entries.map((entry) => entry.address) })
    } catch {
      return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 })
    }
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(WATCHLIST_COOKIE_NAME)?.value
  const result = removeFromWatchlist(session.address, cookieValue, address)

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  cookieStore.set(WATCHLIST_COOKIE_NAME, result.cookie, watchlistCookieOptions())
  return NextResponse.json({ addresses: result.addresses })
}

export const GET = observeRoute(
  { route: '/api/watchlist', method: 'GET' },
  readWatchlist,
)

export const POST = observeRoute(
  { route: '/api/watchlist', method: 'POST' },
  addWatchlistEntry,
)

export const DELETE = observeRoute(
  { route: '/api/watchlist', method: 'DELETE' },
  removeWatchlistEntry,
)
