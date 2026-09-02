import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { enforceSameOrigin } from "@/lib/auth/origin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBackendSessionService } from '@/lib/server/backendServices'
import { readBackendStorageMode } from '@/lib/server/storageMode'
import { observeRoute } from '@/lib/server/observability/route'

async function logout(request: Request): Promise<Response> {
    const originError = enforceSameOrigin(request)
    if (originError) {
        return originError
    }

    const cookieStore = await cookies()
    if (readBackendStorageMode() === 'postgres') {
        try {
            await (await getBackendSessionService()).revoke(
                cookieStore.get(SESSION_COOKIE_NAME)?.value,
            )
        } catch {
            return NextResponse.json({ error: '登出服务暂时不可用' }, { status: 503 })
        }
    }
    cookieStore.delete({ name: SESSION_COOKIE_NAME, path: '/api' })
    return NextResponse.json({ ok: true })
}

export const POST = observeRoute(
    { route: '/api/auth/logout', method: 'POST' },
    logout,
)
