import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { enforceSameOrigin } from "@/lib/auth/origin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
    const originError = enforceSameOrigin(request)
    if (originError) {
        return originError
    }

    (await cookies()).delete({ name: SESSION_COOKIE_NAME, path: '/api' })
    return NextResponse.json({ ok: true })
}
