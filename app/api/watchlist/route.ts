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

export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(WATCHLIST_COOKIE_NAME)?.value
  const addresses = getWatchlist(session.address, cookieValue)
  return NextResponse.json({ addresses })
}

export async function POST(request: Request): Promise<Response> {
  const originError = enforceSameOrigin(request)
  if (originError) return originError

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await readAddress(request)
  if (body instanceof Response) return body
  const { address } = body

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(WATCHLIST_COOKIE_NAME)?.value
  const result = addToWatchlist(session.address, cookieValue, address)

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  cookieStore.set(WATCHLIST_COOKIE_NAME, result.cookie, watchlistCookieOptions())
  return NextResponse.json({ addresses: result.addresses })
}

export async function DELETE(request: Request): Promise<Response> {
  const originError = enforceSameOrigin(request)
  if (originError) return originError

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await readAddress(request)
  if (body instanceof Response) return body
  const { address } = body

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(WATCHLIST_COOKIE_NAME)?.value
  const result = removeFromWatchlist(session.address, cookieValue, address)

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 })
  }

  cookieStore.set(WATCHLIST_COOKIE_NAME, result.cookie, watchlistCookieOptions())
  return NextResponse.json({ addresses: result.addresses })
}
