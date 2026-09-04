import { NextResponse } from 'next/server'
import { observeRoute } from '@/lib/server/observability/route'

async function readLiveness(): Promise<Response> {
  return NextResponse.json(
    { status: 'alive' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const GET = observeRoute(
  { route: '/api/health/live', method: 'GET' },
  readLiveness,
)
