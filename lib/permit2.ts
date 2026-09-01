import { parseAbi } from 'viem'

export const permit2AllowanceAbi = parseAbi([
  'function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function lockdown((address token, address spender)[] approvals)',
])
