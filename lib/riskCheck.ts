import { maxUint256 } from 'viem'

export interface RiskFinding {
  severity: 'high' | 'medium' | 'low'
  code: string
  detail: Record<string, unknown>
}

export function assessRisk(call: { functionName: string; args: readonly unknown[] }): RiskFinding[] {
  if (call.functionName === 'approve' && call.args[1] === maxUint256) {
    return [{ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender: call.args[0] } }]
  }
  return []
}
