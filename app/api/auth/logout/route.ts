import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(): Promise<Response> {
    (await cookies()).delete({ name: SESSION_COOKIE_NAME, path: '/api' })
    return NextResponse.json({ ok: true })
}