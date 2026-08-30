export type NativeTransferBudget =
  | { state: 'unavailable' }
  | { state: 'sufficient'; gasCostLimit: bigint; required: bigint; remaining: bigint }
  | { state: 'insufficient'; gasCostLimit: bigint; required: bigint; shortfall: bigint }

export function resolveNativeTransferBudget(input: {
  value: bigint | undefined
  balance: bigint | undefined
  gas: bigint | undefined
  maxFeePerGas: bigint | undefined
}): NativeTransferBudget {
  const { value, balance, gas, maxFeePerGas } = input
  if (value === undefined || balance === undefined || gas === undefined || maxFeePerGas === undefined) {
    return { state: 'unavailable' }
  }

  const gasCostLimit = gas * maxFeePerGas
  const required = value + gasCostLimit
  if (required <= balance) {
    return { state: 'sufficient', gasCostLimit, required, remaining: balance - required }
  }
  return { state: 'insufficient', gasCostLimit, required, shortfall: required - balance }
}
