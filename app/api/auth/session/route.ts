import { getSession } from '@/lib/auth/session'
import { NextResponse } from 'next/server'
import { observeRoute } from '@/lib/server/observability/route'

async function readSession(): Promise<Response> {
  try {
    const session = await getSession()
    return NextResponse.json(session ? { address: session.address, chainId: session.chainId } : null)
  } catch {
    return NextResponse.json({ error: '认证服务暂时不可用' }, { status: 503 })
  }
}

export const GET = observeRoute(
  { route: '/api/auth/session', method: 'GET' },
  readSession,
)
