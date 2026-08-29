import { isHex } from 'viem'
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/lib/auth/session'
import { NONCE_COOKIE_NAME, verifySignIn } from '@/lib/auth/siwe'
import { enforceSameOrigin, getExpectedRequestOrigin } from '@/lib/auth/origin'
import { readJsonBody } from '@/lib/http/json'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<Response> {
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

  try {
    const expectedOrigin = getExpectedRequestOrigin(request)
    if (!expectedOrigin) {
      return NextResponse.json({ error: '服务端 Origin 配置无效' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const nonceCookieValue = cookieStore.get(NONCE_COOKIE_NAME)?.value

    const result = await verifySignIn(message, signature, nonceCookieValue, expectedOrigin)
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 401 })
    }

    const sessionCookie = createSession(result.address, result.chainId)
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
    return NextResponse.json({ error: '登录验证失败' }, { status: 401 })
  }
}
