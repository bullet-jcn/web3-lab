import { getSession } from '@/lib/auth/session'
import { NextResponse } from 'next/server'

export async function GET(): Promise<Response> {
  const session = await getSession()
  return NextResponse.json(session)
}
