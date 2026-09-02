import { NextResponse } from 'next/server'
import { emitStructuredLog } from '@/lib/server/observability/logger'
import { observeRoute } from '@/lib/server/observability/route'
import { getServiceReadinessReport } from '@/lib/server/serviceHealth'

async function readServiceReadiness(): Promise<Response> {
  const report = await getServiceReadinessReport()
  if (report.status !== 'healthy') {
    emitStructuredLog({
      level: report.status === 'unhealthy' ? 'error' : 'warn',
      event: 'service.readiness',
      outcome: report.status,
    })
  }
  return NextResponse.json(report, {
    status: report.status === 'unhealthy' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export const GET = observeRoute(
  { route: '/api/health/ready', method: 'GET' },
  readServiceReadiness,
)
