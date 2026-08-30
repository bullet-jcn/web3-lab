export type TokenBalanceState = 'unavailable' | 'sufficient' | 'insufficient'

export function resolveTokenBalanceState(
  amount: bigint | undefined,
  balance: bigint | undefined,
): TokenBalanceState {
  if (amount === undefined || balance === undefined) return 'unavailable'
  return amount <= balance ? 'sufficient' : 'insufficient'
}
