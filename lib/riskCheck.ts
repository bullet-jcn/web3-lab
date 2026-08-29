import { isAddress, maxUint256, type Address } from 'viem'

export const MAX_RISK_FINDINGS = 10

export interface UnlimitedApprovalFinding {
  severity: 'high'
  code: 'UNLIMITED_APPROVAL'
  detail: { spender: Address }
}

export type RiskFinding = UnlimitedApprovalFinding

type RiskFindingsParseResult =
  | { ok: true; findings: RiskFinding[] }
  | { ok: false; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value)
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key))
}

export function parseRiskFindingsRequest(value: unknown): RiskFindingsParseResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ['findings']) || !Array.isArray(value.findings)) {
    return { ok: false, reason: 'findings 缺失或格式不对' }
  }
  if (value.findings.length > MAX_RISK_FINDINGS) {
    return { ok: false, reason: `findings 最多允许 ${MAX_RISK_FINDINGS} 条` }
  }

  const findings: RiskFinding[] = []
  for (const finding of value.findings) {
    if (!isRecord(finding) || !hasOnlyKeys(finding, ['severity', 'code', 'detail'])) {
      return { ok: false, reason: 'finding 结构不受支持' }
    }
    if (finding.severity !== 'high' || finding.code !== 'UNLIMITED_APPROVAL') {
      return { ok: false, reason: 'finding 风险代码或级别不受支持' }
    }
    if (!isRecord(finding.detail)
      || !hasOnlyKeys(finding.detail, ['spender'])
      || typeof finding.detail.spender !== 'string'
      || !isAddress(finding.detail.spender)) {
      return { ok: false, reason: 'UNLIMITED_APPROVAL detail 格式不对' }
    }
    findings.push({
      severity: 'high',
      code: 'UNLIMITED_APPROVAL',
      detail: { spender: finding.detail.spender },
    })
  }
  return { ok: true, findings }
}

export function formatDeterministicRiskWarning(findings: readonly RiskFinding[]): string {
  return findings.map((finding) => {
    if (finding.code === 'UNLIMITED_APPROVAL') {
      return `检测到高风险：你正在授予 ${finding.detail.spender} 无限额度代币使用权。该权限不会随本次操作自动失效；仅在确认该地址可信且确有需要时继续。`
    }
    return ''
  }).filter(Boolean).join('\n')
}

export function assessRisk(call: { functionName: string; args: readonly unknown[] }): RiskFinding[] {
  if (call.functionName === 'approve'
    && call.args[1] === maxUint256
    && typeof call.args[0] === 'string'
    && isAddress(call.args[0])) {
    return [{ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender: call.args[0] } }]
  }
  return []
}
