import {
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  isAddressEqual,
  maxUint256,
  toFunctionSelector,
  type Address,
  type Hex,
} from 'viem'
import { listTrackedErc20ApprovalTargets } from './approvalRegistry'
import { listSupportedErc20Assets, type SupportedErc20Asset } from './assetRegistry'
import { permit2AllowanceAbi } from './permit2'
import { listTrackedPermit2AllowanceTargets } from './permit2Registry'
import { assessPermissionRisk, type RiskFinding } from './riskCheck'

export const MAX_CALLDATA_BYTES = 16 * 1024
export const MAX_DECODED_PERMISSION_CHANGES = 50

const ERC20_APPROVE_SELECTOR = toFunctionSelector('approve(address,uint256)')
const PERMIT2_LOCKDOWN_SELECTOR = toFunctionSelector('lockdown((address,address)[])')

export type CalldataAnalysisFailureCode =
  | 'INVALID_TARGET'
  | 'INVALID_CALLDATA'
  | 'CALLDATA_TOO_LARGE'
  | 'MALFORMED_SUPPORTED_CALL'
  | 'UNSUPPORTED_CHAIN'
  | 'UNSUPPORTED_CONTRACT'
  | 'UNSUPPORTED_FUNCTION'
  | 'UNSUPPORTED_PERMISSION_TARGET'
  | 'TOO_MANY_PERMISSION_CHANGES'

interface CalldataAnalysisFailure {
  readonly status: 'invalid' | 'unsupported'
  readonly code: CalldataAnalysisFailureCode
  readonly message: string
}

export interface DecodedErc20ApproveCall {
  readonly kind: 'erc20-approve'
  readonly chainId: number
  readonly target: Address
  readonly asset: SupportedErc20Asset
  readonly spender: Address
  readonly spenderLabel?: string
  readonly amount: bigint
  readonly formattedAmount: string
  readonly effect: 'revoke' | 'set-allowance'
  readonly isUnlimited: boolean
  readonly riskFindings: readonly RiskFinding[]
}

export interface DecodedPermit2LockdownPair {
  readonly targetId: string
  readonly token: Address
  readonly tokenName: string
  readonly symbol: string
  readonly spender: Address
  readonly spenderLabel: string
}

export interface DecodedPermit2LockdownCall {
  readonly kind: 'permit2-lockdown'
  readonly chainId: number
  readonly target: Address
  readonly pairs: readonly DecodedPermit2LockdownPair[]
  readonly effect: 'clear-internal-allowances' | 'no-op'
}

export type CalldataAnalysisResult =
  | CalldataAnalysisFailure
  | { readonly status: 'decoded'; readonly call: DecodedErc20ApproveCall | DecodedPermit2LockdownCall }

function invalid(code: CalldataAnalysisFailureCode, message: string): CalldataAnalysisFailure {
  return { status: 'invalid', code, message }
}

function unsupported(code: CalldataAnalysisFailureCode, message: string): CalldataAnalysisFailure {
  return { status: 'unsupported', code, message }
}

function parseTarget(value: string): Address | null {
  const normalized = value.trim()
  if (!isAddress(normalized)) return null
  return getAddress(normalized)
}

function parseCalldata(value: string): Hex | CalldataAnalysisFailure {
  const normalized = value.trim()
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(normalized)) {
    return invalid('INVALID_CALLDATA', 'Calldata 必须是带 0x 前缀、按完整字节编码的十六进制字符串。')
  }
  const byteLength = (normalized.length - 2) / 2
  if (byteLength > MAX_CALLDATA_BYTES) {
    return invalid('CALLDATA_TOO_LARGE', `Calldata 不能超过 ${MAX_CALLDATA_BYTES} bytes。`)
  }
  if (byteLength < 4) {
    return invalid('INVALID_CALLDATA', 'Calldata 至少需要包含 4-byte function selector。')
  }
  return normalized as Hex
}

function selectorOf(data: Hex): Hex {
  return data.slice(0, 10).toLowerCase() as Hex
}

function findSupportedAsset(chainId: number, target: Address): SupportedErc20Asset | undefined {
  return listSupportedErc20Assets(chainId).find((asset) => isAddressEqual(asset.address, target))
}

function decodeErc20Approve(
  chainId: number,
  target: Address,
  asset: SupportedErc20Asset,
  data: Hex,
): CalldataAnalysisResult {
  if (selectorOf(data) !== ERC20_APPROVE_SELECTOR) {
    return unsupported('UNSUPPORTED_FUNCTION', '该 ERC-20 合约已登记，但当前只支持解释 approve(address,uint256)。')
  }

  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data })
    if (decoded.functionName !== 'approve' || !decoded.args) throw new Error('unexpected decoded call')
    const [spender, amount] = decoded.args
    const trackedTarget = listTrackedErc20ApprovalTargets(chainId).find((candidate) => (
      isAddressEqual(candidate.asset.address, target) && isAddressEqual(candidate.spender, spender)
    ))
    return {
      status: 'decoded',
      call: Object.freeze({
        kind: 'erc20-approve',
        chainId,
        target,
        asset,
        spender,
        spenderLabel: trackedTarget?.spenderLabel,
        amount,
        formattedAmount: formatUnits(amount, asset.decimals),
        effect: amount === BigInt(0) ? 'revoke' : 'set-allowance',
        isUnlimited: amount === maxUint256,
        riskFindings: Object.freeze(assessPermissionRisk({
          spender,
          amount,
          token: asset.address,
          symbol: asset.symbol,
          highApprovalThreshold: asset.highApprovalThreshold,
          isSpenderRecognized: Boolean(trackedTarget),
        })),
      }),
    }
  } catch {
    return invalid('MALFORMED_SUPPORTED_CALL', 'Selector 是 ERC-20 approve，但参数编码不完整或不合法。')
  }
}

function decodePermit2Lockdown(
  chainId: number,
  target: Address,
  data: Hex,
): CalldataAnalysisResult {
  if (selectorOf(data) !== PERMIT2_LOCKDOWN_SELECTOR) {
    return unsupported('UNSUPPORTED_FUNCTION', '该 Permit2 合约已登记，但当前只支持解释 lockdown((address,address)[])。')
  }

  try {
    const decoded = decodeFunctionData({ abi: permit2AllowanceAbi, data })
    if (decoded.functionName !== 'lockdown' || !decoded.args) throw new Error('unexpected decoded call')
    const [rawPairs] = decoded.args
    if (rawPairs.length > MAX_DECODED_PERMISSION_CHANGES) {
      return unsupported(
        'TOO_MANY_PERMISSION_CHANGES',
        `一次最多解释 ${MAX_DECODED_PERMISSION_CHANGES} 项权限变化。`,
      )
    }

    const registeredTargets = listTrackedPermit2AllowanceTargets(chainId)
    const pairs: DecodedPermit2LockdownPair[] = []
    for (const pair of rawPairs) {
      const registered = registeredTargets.find((candidate) => (
        isAddressEqual(candidate.asset.address, pair.token)
        && isAddressEqual(candidate.spender, pair.spender)
      ))
      if (!registered) {
        return unsupported(
          'UNSUPPORTED_PERMISSION_TARGET',
          `Permit2 tuple ${pair.token} / ${pair.spender} 不在当前 Approval Registry 支持范围内。`,
        )
      }
      pairs.push(Object.freeze({
        targetId: registered.id,
        token: pair.token,
        tokenName: registered.asset.name,
        symbol: registered.asset.symbol,
        spender: pair.spender,
        spenderLabel: registered.spenderLabel,
      }))
    }

    return {
      status: 'decoded',
      call: Object.freeze({
        kind: 'permit2-lockdown',
        chainId,
        target,
        pairs: Object.freeze(pairs),
        effect: pairs.length === 0 ? 'no-op' : 'clear-internal-allowances',
      }),
    }
  } catch {
    return invalid('MALFORMED_SUPPORTED_CALL', 'Selector 是 Permit2 lockdown，但 tuple 数组编码不完整或不合法。')
  }
}

export function analyzeCalldata(input: {
  readonly chainId: number
  readonly to: string
  readonly data: string
}): CalldataAnalysisResult {
  const target = parseTarget(input.to)
  if (!target) return invalid('INVALID_TARGET', '目标合约地址格式不合法。')

  const data = parseCalldata(input.data)
  if (typeof data !== 'string') return data

  const assets = listSupportedErc20Assets(input.chainId)
  const permit2Targets = listTrackedPermit2AllowanceTargets(input.chainId)
  if (assets.length === 0 && permit2Targets.length === 0) {
    return unsupported('UNSUPPORTED_CHAIN', `Chain ${input.chainId} 尚未配置 calldata 解码 Registry。`)
  }

  const asset = findSupportedAsset(input.chainId, target)
  if (asset) return decodeErc20Approve(input.chainId, target, asset, data)

  const isCanonicalPermit2 = permit2Targets.some((candidate) => isAddressEqual(candidate.permit2Address, target))
  if (isCanonicalPermit2) return decodePermit2Lockdown(input.chainId, target, data)

  return unsupported(
    'UNSUPPORTED_CONTRACT',
    '目标地址不是该链 Registry 中已支持的 ERC-20 或 canonical Permit2 合约。',
  )
}
