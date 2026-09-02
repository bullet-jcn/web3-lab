import { createNonceCookie, NONCE_COOKIE_NAME, NONCE_TTL_SECONDS } from "@/lib/auth/siwe";
import { getBackendNonceService } from '@/lib/server/backendServices'
import { readBackendStorageMode } from '@/lib/server/storageMode'
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { observeRoute } from '@/lib/server/observability/route'

async function issueNonce(): Promise<Response> {
    const mode = readBackendStorageMode()
    let nonce: string
    let cookie: string
    try {
        if (mode === 'postgres') {
            nonce = await (await getBackendNonceService()).issue()
            cookie = nonce
        } else {
            const legacy = createNonceCookie()
            nonce = legacy.nonce
            cookie = legacy.cookie
        }
    } catch {
        return NextResponse.json({ error: '登录服务暂时不可用' }, { status: 503 })
    }
    const cookieStore = await cookies()
    const option = {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        maxAge: NONCE_TTL_SECONDS,
        path: "/api/auth",
    }
    cookieStore.set(NONCE_COOKIE_NAME, cookie, option)

    return NextResponse.json({ nonce })
}

export const GET = observeRoute(
    { route: '/api/auth/nonce', method: 'GET' },
    issueNonce,
)
