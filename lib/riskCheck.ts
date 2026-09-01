import { isAddress, maxUint256, type Address } from 'viem'

export const MAX_RISK_FINDINGS = 10

export type RiskFinding =
  | { readonly severity: 'high'; readonly code: 'UNLIMITED_APPROVAL'; readonly detail: { readonly spender: Address } }
  | { readonly severity: 'medium'; readonly code: 'HIGH_APPROVAL'; readonly detail: { readonly spender: Address; readonly token: Address; readonly amount: string; readonly threshold: string; readonly symbol: string } }
  | { readonly severity: 'medium'; readonly code: 'UNRECOGNIZED_SPENDER'; readonly detail: { readonly spender: Address } }
  | { readonly severity: 'high'; readonly code: 'ACCOUNT_MISMATCH'; readonly detail: { readonly owner: Address; readonly activeAccount: Address } }
  | { readonly severity: 'high'; readonly code: 'CHAIN_MISMATCH'; readonly detail: { readonly requestedChainId: number; readonly activeChainId: number } }
  | { readonly severity: 'medium'; readonly code: 'EXPIRED_DEADLINE'; readonly detail: { readonly deadline: string; readonly observedAt: string } }

type RiskFindingsParseResult = { ok: true; findings: RiskFinding[] } | { ok: false; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value)
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key))
}

function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value)
}

function parseFinding(value: unknown): RiskFinding | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['severity', 'code', 'detail']) || !isRecord(value.detail)) return null
  const detail = value.detail
  if (value.severity === 'high' && value.code === 'UNLIMITED_APPROVAL' && hasOnlyKeys(detail, ['spender']) && typeof detail.spender === 'string' && isAddress(detail.spender)) return { severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender: detail.spender } }
  if (value.severity === 'medium' && value.code === 'UNRECOGNIZED_SPENDER' && hasOnlyKeys(detail, ['spender']) && typeof detail.spender === 'string' && isAddress(detail.spender)) return { severity: 'medium', code: 'UNRECOGNIZED_SPENDER', detail: { spender: detail.spender } }
  if (value.severity === 'medium' && value.code === 'HIGH_APPROVAL' && hasOnlyKeys(detail, ['spender', 'token', 'amount', 'threshold', 'symbol']) && typeof detail.spender === 'string' && isAddress(detail.spender) && typeof detail.token === 'string' && isAddress(detail.token) && isDecimal(detail.amount) && isDecimal(detail.threshold) && typeof detail.symbol === 'string' && /^[A-Za-z0-9._-]{1,16}$/.test(detail.symbol)) return { severity: 'medium', code: 'HIGH_APPROVAL', detail: { spender: detail.spender, token: detail.token, amount: detail.amount, threshold: detail.threshold, symbol: detail.symbol } }
  if (value.severity === 'high' && value.code === 'ACCOUNT_MISMATCH' && hasOnlyKeys(detail, ['owner', 'activeAccount']) && typeof detail.owner === 'string' && isAddress(detail.owner) && typeof detail.activeAccount === 'string' && isAddress(detail.activeAccount)) return { severity: 'high', code: 'ACCOUNT_MISMATCH', detail: { owner: detail.owner, activeAccount: detail.activeAccount } }
  if (value.severity === 'high' && value.code === 'CHAIN_MISMATCH' && hasOnlyKeys(detail, ['requestedChainId', 'activeChainId']) && Number.isSafeInteger(detail.requestedChainId) && Number(detail.requestedChainId) > 0 && Number.isSafeInteger(detail.activeChainId) && Number(detail.activeChainId) > 0) return { severity: 'high', code: 'CHAIN_MISMATCH', detail: { requestedChainId: Number(detail.requestedChainId), activeChainId: Number(detail.activeChainId) } }
  if (value.severity === 'medium' && value.code === 'EXPIRED_DEADLINE' && hasOnlyKeys(detail, ['deadline', 'observedAt']) && isDecimal(detail.deadline) && isDecimal(detail.observedAt)) return { severity: 'medium', code: 'EXPIRED_DEADLINE', detail: { deadline: detail.deadline, observedAt: detail.observedAt } }
  return null
}

export function parseRiskFindingsRequest(value: unknown): RiskFindingsParseResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ['findings']) || !Array.isArray(value.findings)) return { ok: false, reason: 'findings 缺失或格式不对' }
  if (value.findings.length > MAX_RISK_FINDINGS) return { ok: false, reason: `findings 最多允许 ${MAX_RISK_FINDINGS} 条` }
  const findings: RiskFinding[] = []
  for (const valueFinding of value.findings) {
    const finding = parseFinding(valueFinding)
    if (!finding) return { ok: false, reason: 'finding 风险代码、级别或 detail 不受支持' }
    findings.push(finding)
  }
  return { ok: true, findings }
}

export function formatDeterministicRiskWarning(findings: readonly RiskFinding[]): string {
  return findings.map((finding) => {
    switch (finding.code) {
      case 'UNLIMITED_APPROVAL': return `检测到高风险：你正在授予 ${finding.detail.spender} 无限额度代币使用权。该权限不会随本次操作自动失效；仅在确认该地址可信且确有需要时继续。`
      case 'HIGH_APPROVAL': return `检测到较高授权：给 ${finding.detail.spender} 的 ${finding.detail.symbol} 原始额度 ${finding.detail.amount} 已达到产品策略阈值 ${finding.detail.threshold}。请核对业务需要。`
      case 'UNRECOGNIZED_SPENDER': return `Spender ${finding.detail.spender} 未出现在当前应用 Registry 中；这不等于恶意，但应用无法提供可信标签。`
      case 'ACCOUNT_MISMATCH': return `签名消息中的 owner ${finding.detail.owner} 与当前钱包 ${finding.detail.activeAccount} 不一致，已阻止按当前上下文解释为本人授权。`
      case 'CHAIN_MISMATCH': return `签名 domain 指向 chain ${finding.detail.requestedChainId}，当前钱包位于 chain ${finding.detail.activeChainId}，存在跨链上下文不一致。`
      case 'EXPIRED_DEADLINE': return `签名 deadline ${finding.detail.deadline} 已早于链上观察时间 ${finding.detail.observedAt}，该签名当前应无法执行。`
    }
  }).join('\n')
}

export function assessPermissionRisk(input: {
  readonly spender: Address; readonly amount: bigint; readonly token?: Address; readonly symbol?: string
  readonly highApprovalThreshold?: bigint; readonly isSpenderRecognized?: boolean
  readonly owner?: Address; readonly activeAccount?: Address
  readonly requestedChainId?: number; readonly activeChainId?: number
  readonly deadline?: bigint; readonly observedAt?: bigint; readonly unlimitedAmount?: bigint
}): RiskFinding[] {
  const findings: RiskFinding[] = []
  if (input.amount === (input.unlimitedAmount ?? maxUint256)) findings.push({ severity: 'high', code: 'UNLIMITED_APPROVAL', detail: { spender: input.spender } })
  else if (input.token && input.symbol && input.highApprovalThreshold !== undefined && input.amount >= input.highApprovalThreshold && input.amount > BigInt(0)) findings.push({ severity: 'medium', code: 'HIGH_APPROVAL', detail: { spender: input.spender, token: input.token, amount: input.amount.toString(), threshold: input.highApprovalThreshold.toString(), symbol: input.symbol } })
  if (input.isSpenderRecognized === false) findings.push({ severity: 'medium', code: 'UNRECOGNIZED_SPENDER', detail: { spender: input.spender } })
  if (input.owner && input.activeAccount && input.owner.toLowerCase() !== input.activeAccount.toLowerCase()) findings.push({ severity: 'high', code: 'ACCOUNT_MISMATCH', detail: { owner: input.owner, activeAccount: input.activeAccount } })
  if (input.requestedChainId && input.activeChainId && input.requestedChainId !== input.activeChainId) findings.push({ severity: 'high', code: 'CHAIN_MISMATCH', detail: { requestedChainId: input.requestedChainId, activeChainId: input.activeChainId } })
  if (input.deadline !== undefined && input.observedAt !== undefined && input.observedAt > input.deadline) findings.push({ severity: 'medium', code: 'EXPIRED_DEADLINE', detail: { deadline: input.deadline.toString(), observedAt: input.observedAt.toString() } })
  return findings
}

export function assessRisk(call: { functionName: string; args: readonly unknown[] }): RiskFinding[] {
  if (call.functionName === 'approve' && typeof call.args[0] === 'string' && isAddress(call.args[0]) && typeof call.args[1] === 'bigint') return assessPermissionRisk({ spender: call.args[0], amount: call.args[1] })
  return []
}
