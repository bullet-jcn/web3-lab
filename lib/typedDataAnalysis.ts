import { formatUnits, getAddress, hashTypedData, isAddress, isAddressEqual, maxUint160, maxUint256, zeroAddress, type Address, type Hash } from 'viem'
import { listTrackedErc20ApprovalTargets } from './approvalRegistry'
import { listSupportedErc20Assets, type SupportedErc20Asset } from './assetRegistry'
import { listTrackedPermit2AllowanceTargets } from './permit2Registry'
import { assessPermissionRisk, type RiskFinding } from './riskCheck'

export const MAX_TYPED_DATA_BYTES = 32 * 1024

const EIP2612_PERMIT_FIELDS = [
  { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
] as const
const EIP2612_DOMAIN_FIELDS = [
  { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
] as const
const PERMIT2_DETAILS_FIELDS = [
  { name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' },
  { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' },
] as const
const PERMIT2_SINGLE_FIELDS = [
  { name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' },
] as const
const PERMIT2_DOMAIN_FIELDS = [
  { name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
] as const

type Failure = { readonly status: 'invalid' | 'unsupported'; readonly code: string; readonly message: string }
interface CommonCall { readonly chainId: number; readonly verifyingContract: Address; readonly digest: Hash; readonly spender: Address; readonly spenderLabel?: string; readonly riskFindings: readonly RiskFinding[] }
export interface Eip2612PermitCall extends CommonCall { readonly kind: 'eip2612-permit'; readonly asset: SupportedErc20Asset; readonly owner: Address; readonly value: bigint; readonly formattedValue: string; readonly nonce: bigint; readonly deadline: bigint; readonly effect: 'revoke' | 'set-allowance'; readonly isUnlimited: boolean }
export interface Permit2PermitSingleCall extends CommonCall { readonly kind: 'permit2-permit-single'; readonly asset: SupportedErc20Asset; readonly amount: bigint; readonly formattedAmount: string; readonly expiration: bigint; readonly nonce: bigint; readonly sigDeadline: bigint; readonly isUnlimited: boolean }
export type TypedDataAnalysisResult = Failure | { readonly status: 'decoded'; readonly call: Eip2612PermitCall | Permit2PermitSingleCall }

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function onlyKeys(value: Record<string, unknown>, keys: readonly string[]) { const actual = Object.keys(value); return actual.length === keys.length && actual.every((key) => keys.includes(key)) }
function sameFields(value: unknown, expected: readonly { readonly name: string; readonly type: string }[]) { return Array.isArray(value) && value.length === expected.length && value.every((field, i) => isRecord(field) && onlyKeys(field, ['name', 'type']) && field.name === expected[i]?.name && field.type === expected[i]?.type) }
function uint(value: unknown, bits: number): bigint | null {
  if ((typeof value !== 'string' || !/^(?:0|[1-9][0-9]*|0x[0-9a-fA-F]+)$/.test(value)) && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) return null
  try { const parsed = BigInt(value); return parsed >= BigInt(0) && parsed < (BigInt(1) << BigInt(bits)) ? parsed : null } catch { return null }
}
function address(value: unknown): Address | null { return typeof value === 'string' && isAddress(value) ? getAddress(value) : null }
function fail(status: 'invalid' | 'unsupported', code: string, message: string): Failure { return { status, code, message } }
function parseJson(raw: string): Record<string, unknown> | Failure {
  if (new TextEncoder().encode(raw).byteLength > MAX_TYPED_DATA_BYTES) return fail('invalid', 'TYPED_DATA_TOO_LARGE', `Typed data 不能超过 ${MAX_TYPED_DATA_BYTES} bytes。`)
  try { const value: unknown = JSON.parse(raw); return isRecord(value) && onlyKeys(value, ['types', 'primaryType', 'domain', 'message']) ? value : fail('invalid', 'INVALID_TYPED_DATA', 'Typed data 必须只包含 types、primaryType、domain 和 message。') } catch { return fail('invalid', 'INVALID_JSON', 'Typed data 不是合法 JSON。') }
}
function chainNumber(value: unknown): number | null { const parsed = uint(value, 256); return parsed !== null && parsed <= BigInt(Number.MAX_SAFE_INTEGER) && parsed > BigInt(0) ? Number(parsed) : null }
function knownSpender(chainId: number, token: Address, spender: Address) { return listTrackedErc20ApprovalTargets(chainId).find((item) => isAddressEqual(item.asset.address, token) && isAddressEqual(item.spender, spender)) }

function analyzeEip2612(root: Record<string, unknown>, activeAccount: Address | undefined, activeChainId: number | undefined, observedAt: bigint | undefined): TypedDataAnalysisResult {
  if (!isRecord(root.types) || !onlyKeys(root.types, ['EIP712Domain', 'Permit']) || !sameFields(root.types.EIP712Domain, EIP2612_DOMAIN_FIELDS) || !sameFields(root.types.Permit, EIP2612_PERMIT_FIELDS)) return fail('unsupported', 'UNSUPPORTED_TYPED_SCHEMA', 'Permit schema 与 EIP-2612 不完全匹配。')
  if (!isRecord(root.domain) || !onlyKeys(root.domain, ['name', 'version', 'chainId', 'verifyingContract']) || !isRecord(root.message) || !onlyKeys(root.message, ['owner', 'spender', 'value', 'nonce', 'deadline'])) return fail('invalid', 'INVALID_TYPED_DATA', 'EIP-2612 domain 或 message 字段不完整。')
  const chainId = chainNumber(root.domain.chainId); const verifyingContract = address(root.domain.verifyingContract)
  const owner = address(root.message.owner); const spender = address(root.message.spender)
  const value = uint(root.message.value, 256); const nonce = uint(root.message.nonce, 256); const deadline = uint(root.message.deadline, 256)
  if (!chainId || !verifyingContract || !owner || owner === zeroAddress || !spender || value === null || nonce === null || deadline === null) return fail('invalid', 'INVALID_TYPED_VALUE', 'EIP-2612 owner 必须非零，地址与 uint256 字段必须合法。')
  const asset = listSupportedErc20Assets(chainId).find((item) => isAddressEqual(item.address, verifyingContract) && item.eip2612Domain)
  if (!asset?.eip2612Domain) return fail('unsupported', 'UNSUPPORTED_DOMAIN', 'verifyingContract 不在该链已核验的 EIP-2612 Registry 中。')
  if (root.domain.name !== asset.eip2612Domain.name || root.domain.version !== asset.eip2612Domain.version) return fail('unsupported', 'DOMAIN_MISMATCH', 'domain name/version 与 Registry 核验值不匹配。')
  const tracked = knownSpender(chainId, asset.address, spender)
  const riskFindings = assessPermissionRisk({ spender, amount: value, token: asset.address, symbol: asset.symbol, highApprovalThreshold: asset.highApprovalThreshold, isSpenderRecognized: Boolean(tracked), owner, activeAccount, requestedChainId: chainId, activeChainId, deadline, observedAt })
  const domain = { name: asset.eip2612Domain.name, version: asset.eip2612Domain.version, chainId, verifyingContract }
  const message = { owner, spender, value, nonce, deadline }
  return { status: 'decoded', call: Object.freeze({ kind: 'eip2612-permit', chainId, verifyingContract, asset, owner, spender, spenderLabel: tracked?.spenderLabel, value, formattedValue: formatUnits(value, asset.decimals), nonce, deadline, effect: value === BigInt(0) ? 'revoke' : 'set-allowance', isUnlimited: value === maxUint256, digest: hashTypedData({ domain, types: { Permit: EIP2612_PERMIT_FIELDS }, primaryType: 'Permit', message }), riskFindings: Object.freeze(riskFindings) }) }
}

function analyzePermit2(root: Record<string, unknown>, activeChainId: number | undefined, observedAt: bigint | undefined): TypedDataAnalysisResult {
  if (!isRecord(root.types) || !onlyKeys(root.types, ['EIP712Domain', 'PermitDetails', 'PermitSingle']) || !sameFields(root.types.EIP712Domain, PERMIT2_DOMAIN_FIELDS) || !sameFields(root.types.PermitDetails, PERMIT2_DETAILS_FIELDS) || !sameFields(root.types.PermitSingle, PERMIT2_SINGLE_FIELDS)) return fail('unsupported', 'UNSUPPORTED_TYPED_SCHEMA', 'Permit2 PermitSingle schema 不完全匹配。')
  if (!isRecord(root.domain) || !onlyKeys(root.domain, ['name', 'chainId', 'verifyingContract']) || !isRecord(root.message) || !onlyKeys(root.message, ['details', 'spender', 'sigDeadline']) || !isRecord(root.message.details) || !onlyKeys(root.message.details, ['token', 'amount', 'expiration', 'nonce'])) return fail('invalid', 'INVALID_TYPED_DATA', 'Permit2 domain 或 message 字段不完整。')
  const chainId = chainNumber(root.domain.chainId); const verifyingContract = address(root.domain.verifyingContract)
  const token = address(root.message.details.token); const spender = address(root.message.spender)
  const amount = uint(root.message.details.amount, 160); const expiration = uint(root.message.details.expiration, 48); const nonce = uint(root.message.details.nonce, 48); const sigDeadline = uint(root.message.sigDeadline, 256)
  if (!chainId || !verifyingContract || !token || !spender || amount === null || expiration === null || nonce === null || sigDeadline === null) return fail('invalid', 'INVALID_TYPED_VALUE', 'Permit2 地址或整数宽度不合法。')
  const targets = listTrackedPermit2AllowanceTargets(chainId)
  if (root.domain.name !== 'Permit2' || !targets.some((item) => isAddressEqual(item.permit2Address, verifyingContract))) return fail('unsupported', 'DOMAIN_MISMATCH', 'Permit2 domain name、chain 或 verifyingContract 未通过 Registry。')
  const asset = listSupportedErc20Assets(chainId).find((item) => isAddressEqual(item.address, token))
  if (!asset) return fail('unsupported', 'UNSUPPORTED_PERMISSION_TARGET', 'Permit2 token 不在当前 Asset Registry。')
  const tracked = targets.find((item) => isAddressEqual(item.asset.address, token) && isAddressEqual(item.spender, spender))
  const deadline = expiration < sigDeadline ? expiration : sigDeadline
  const riskFindings = assessPermissionRisk({ spender, amount, token, symbol: asset.symbol, highApprovalThreshold: asset.highApprovalThreshold, isSpenderRecognized: Boolean(tracked), requestedChainId: chainId, activeChainId, deadline, observedAt, unlimitedAmount: maxUint160 })
  const domain = { name: 'Permit2', chainId, verifyingContract }
  const message = { details: { token, amount, expiration: Number(expiration), nonce: Number(nonce) }, spender, sigDeadline }
  return { status: 'decoded', call: Object.freeze({ kind: 'permit2-permit-single', chainId, verifyingContract, asset, spender, spenderLabel: tracked?.spenderLabel, amount, formattedAmount: formatUnits(amount, asset.decimals), expiration, nonce, sigDeadline, isUnlimited: amount === maxUint160, digest: hashTypedData({ domain, types: { PermitDetails: PERMIT2_DETAILS_FIELDS, PermitSingle: PERMIT2_SINGLE_FIELDS }, primaryType: 'PermitSingle', message }), riskFindings: Object.freeze(riskFindings) }) }
}

export function analyzeTypedDataJson(input: { readonly raw: string; readonly activeAccount?: Address; readonly activeChainId?: number; readonly observedAt?: bigint }): TypedDataAnalysisResult {
  const root = parseJson(input.raw); if ('status' in root) return root as Failure
  if (root.primaryType === 'Permit') return analyzeEip2612(root, input.activeAccount, input.activeChainId, input.observedAt)
  if (root.primaryType === 'PermitSingle') return analyzePermit2(root, input.activeChainId, input.observedAt)
  return fail('unsupported', 'UNSUPPORTED_PRIMARY_TYPE', '当前只支持 EIP-2612 Permit 与 Permit2 PermitSingle。')
}

export function createEip2612Sample(owner: Address, chainId: number, deadline: bigint): string {
  const asset = listSupportedErc20Assets(chainId).find((item) => item.eip2612Domain); if (!asset?.eip2612Domain) return ''
  return JSON.stringify({ types: { EIP712Domain: EIP2612_DOMAIN_FIELDS, Permit: EIP2612_PERMIT_FIELDS }, primaryType: 'Permit', domain: { name: asset.eip2612Domain.name, version: asset.eip2612Domain.version, chainId: chainId.toString(), verifyingContract: asset.address }, message: { owner, spender: listTrackedErc20ApprovalTargets(chainId)[0]?.spender, value: maxUint256.toString(), nonce: '0', deadline: deadline.toString() } }, null, 2)
}

export function createPermit2Sample(chainId: number, deadline: bigint): string {
  const target = listTrackedPermit2AllowanceTargets(chainId)[0]; if (!target) return ''
  return JSON.stringify({ types: { EIP712Domain: PERMIT2_DOMAIN_FIELDS, PermitDetails: PERMIT2_DETAILS_FIELDS, PermitSingle: PERMIT2_SINGLE_FIELDS }, primaryType: 'PermitSingle', domain: { name: 'Permit2', chainId: chainId.toString(), verifyingContract: target.permit2Address }, message: { details: { token: target.asset.address, amount: maxUint160.toString(), expiration: deadline.toString(), nonce: '0' }, spender: target.spender, sigDeadline: deadline.toString() } }, null, 2)
}
