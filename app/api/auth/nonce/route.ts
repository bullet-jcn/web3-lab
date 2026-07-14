import { createNonceCookie, NONCE_COOKIE_NAME, NONCE_TTL_SECONDS } from "@/lib/auth/siwe";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(): Promise<Response> {
    const { nonce, cookie } = createNonceCookie()
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