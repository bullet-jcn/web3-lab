export type NativeTransferBudget =
  | { state: 'unavailable' }
  | { state: 'sufficient'; gasCostLimit: bigint; required: bigint; remaining: bigint }
  | { state: 'insufficient'; gasCostLimit: bigint; required: bigint; shortfall: bigint }

export type NativeMaxTransfer =
  | { state: 'unavailable' }
  | { state: 'no-transferable-balance'; gasCostLimit: bigint }
  | { state: 'available'; gasCostLimit: bigint; value: bigint }

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

export function resolveNativeMaxTransfer(input: {
  balance: bigint | undefined
  gas: bigint | undefined
  maxFeePerGas: bigint | undefined
}): NativeMaxTransfer {
  const { balance, gas, maxFeePerGas } = input
  if (balance === undefined || gas === undefined || maxFeePerGas === undefined) {
    return { state: 'unavailable' }
  }

  const gasCostLimit = gas * maxFeePerGas
  if (balance <= gasCostLimit) {
    return { state: 'no-transferable-balance', gasCostLimit }
  }

  return { state: 'available', gasCostLimit, value: balance - gasCostLimit }
}
