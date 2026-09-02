import { isHex } from 'viem'
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/lib/auth/session'
import { NONCE_COOKIE_NAME, verifySignIn, verifySignInWithNonce } from '@/lib/auth/siwe'
import { enforceSameOrigin, getExpectedRequestOrigin } from '@/lib/auth/origin'
import { readJsonBody } from '@/lib/http/json'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getBackendNonceService, getBackendSessionService } from '@/lib/server/backendServices'
import { readBackendStorageMode } from '@/lib/server/storageMode'
import { observeRoute } from '@/lib/server/observability/route'

async function verifySession(request: Request): Promise<Response> {
  const originError = enforceSameOrigin(request)
  if (originError) return originError

  const parsedBody = await readJsonBody(request, 8 * 1024)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.value
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'message/signature 缺失或格式不对' }, { status: 400 })
  }
  const { message, signature } = body as Record<string, unknown>
  if (typeof message !== 'string' || typeof signature !== 'string' || !isHex(signature)) {
    return NextResponse.json({ error: 'message/signature 缺失或格式不对' }, { status: 400 })
  }

  const mode = readBackendStorageMode()
  try {
    const expectedOrigin = getExpectedRequestOrigin(request)
    if (!expectedOrigin) {
      return NextResponse.json({ error: '服务端 Origin 配置无效' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const nonceCookieValue = cookieStore.get(NONCE_COOKIE_NAME)?.value

    const result = mode === 'postgres'
      ? await verifySignInWithNonce(message, signature, nonceCookieValue, expectedOrigin)
      : await verifySignIn(message, signature, nonceCookieValue, expectedOrigin)
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 401 })
    }

    let sessionCookie: string
    if (mode === 'postgres') {
      const nonceConsumed = await (await getBackendNonceService()).consume(nonceCookieValue!)
      if (!nonceConsumed) {
        return NextResponse.json({ error: 'nonce 缺失或已过期' }, { status: 401 })
      }
      sessionCookie = (
        await (await getBackendSessionService()).create(result.address, result.chainId)
      ).token
    } else {
      sessionCookie = createSession(result.address, result.chainId)
    }
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_SECONDS,
      path: '/api',
    })
    cookieStore.delete(NONCE_COOKIE_NAME)

    return NextResponse.json({ address: result.address, chainId: result.chainId })
  } catch {
    return mode === 'postgres'
      ? NextResponse.json({ error: '登录服务暂时不可用' }, { status: 503 })
      : NextResponse.json({ error: '登录验证失败' }, { status: 401 })
  }
}

export const POST = observeRoute(
  { route: '/api/auth/verify', method: 'POST' },
  verifySession,
)
