import { NextResponse } from 'next/server'
import { getRpcHealthReport } from '@/lib/server/rpcHealth'
import { emitStructuredLog } from '@/lib/server/observability/logger'
import { observeRoute } from '@/lib/server/observability/route'

async function readRpcHealth(): Promise<Response> {
  const report = await getRpcHealthReport()
  if (report.status !== 'healthy') {
    emitStructuredLog({
      level: report.status === 'unhealthy' ? 'error' : 'warn',
      event: 'dependency.degraded',
      outcome: report.status,
      dependency: 'rpc',
    })
  }
  return NextResponse.json(report, {
    status: report.status === 'unhealthy' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export const GET = observeRoute(
  { route: '/api/health/rpc', method: 'GET', dependency: 'rpc' },
  readRpcHealth,
)
