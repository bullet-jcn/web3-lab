export const DEMO_ERC20_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const

// Demo-only recipients for exercising transfers on testnet; no real value at stake.
// A/B feed BatchedTransferDemo's two-call batch, C is TokenTransferPanel's single-transfer target.
export const DEMO_RECIPIENT_A = '0xcB29F8F0Aefc72E7Cf447328e0c4B7eDd94a2739' as const
export const DEMO_RECIPIENT_B = '0x7b2c939388f9D15b7B0c37CF5b18C17f3710b11b' as const
export const DEMO_RECIPIENT_C = '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' as const

export const DEMO_TRANSFER_AMOUNT = BigInt(1)

// Reuses DEMO_RECIPIENT_B's address under a name that matches its role here:
// an ERC20 "spender" being granted an allowance, not a transfer recipient.
export const DEMO_SPENDER_ADDRESS = DEMO_RECIPIENT_B
