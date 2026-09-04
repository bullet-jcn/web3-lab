import { NONCE_COOKIE_NAME } from '@/lib/auth/siwe'
import { SESSION_COOKIE_NAME, getSession } from '@/lib/auth/session'
import { enforceSameOrigin } from '@/lib/auth/origin'
import { WATCHLIST_COOKIE_NAME } from '@/lib/auth/watchlist'
import { readJsonBody } from '@/lib/http/json'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/accountDeletion'
import { getBackendDataLifecycleRepository } from '@/lib/server/backendServices'
import { observeRoute } from '@/lib/server/observability/route'
import { readBackendStorageMode } from '@/lib/server/storageMode'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function deleteAccount(request: Request): Promise<Response> {
  const originError = enforceSameOrigin(request)
  if (originError) return originError

  const parsedBody = await readJsonBody(request, 256)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.value
  if (
    !body
    || typeof body !== 'object'
    || (body as Record<string, unknown>).confirmation !== ACCOUNT_DELETION_CONFIRMATION
  ) {
    return NextResponse.json({ error: '账户删除确认文字不正确' }, { status: 400 })
  }

  if (readBackendStorageMode() !== 'postgres') {
    return NextResponse.json({ error: '持久化服务处于回滚模式，请稍后重试或联系支持' }, { status: 503 })
  }

  let session
  try {
    session = await getSession()
  } catch {
    return NextResponse.json({ error: '认证服务暂时不可用' }, { status: 503 })
  }
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (!session.userId) {
    return NextResponse.json({ error: 'Session 数据不完整' }, { status: 500 })
  }

  try {
    const deleted = await (await getBackendDataLifecycleRepository()).deleteUserData(session.userId)
    if (!deleted) return NextResponse.json({ error: '账户数据已经不存在' }, { status: 409 })
  } catch {
    return NextResponse.json({ error: '账户删除服务暂时不可用' }, { status: 503 })
  }

  const cookieStore = await cookies()
  cookieStore.delete({ name: SESSION_COOKIE_NAME, path: '/api' })
  cookieStore.delete({ name: NONCE_COOKIE_NAME, path: '/api/auth' })
  cookieStore.delete({ name: WATCHLIST_COOKIE_NAME, path: '/api' })

  return NextResponse.json({
    deleted: true,
    onchainDataUnaffected: true,
  })
}

export const DELETE = observeRoute(
  { route: '/api/account', method: 'DELETE', dependency: 'postgres' },
  deleteAccount,
)
