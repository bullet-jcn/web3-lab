import { isHex } from 'viem'
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/lib/auth/session'
import { NONCE_COOKIE_NAME, verifySignIn } from '@/lib/auth/siwe'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<Response> {
  try {
    const { message, signature } = await request.json()
    if (typeof message !== 'string' || typeof signature !== 'string' || !isHex(signature)) {
      return NextResponse.json({ error: 'message/signature 缺失或格式不对' }, { status: 400 })
    }

    const domain = request.headers.get('host')
    if (!domain) {
      return NextResponse.json({ error: '缺少 host 请求头' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const nonceCookieValue = cookieStore.get(NONCE_COOKIE_NAME)?.value

    const result = await verifySignIn(message, signature, nonceCookieValue, domain)
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
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }
}
