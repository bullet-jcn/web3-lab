import { parseEther, type Address } from 'viem'
import { parseTransferRecipient } from './transferRecipient'

export type NativeTransferInputResult =
  | { ok: true; recipient: Address; value: bigint }
  | { ok: false; recipientError?: string; amountError?: string }

export function parseNativeTransferInput(
  recipientInput: string,
  amountInput: string,
): NativeTransferInputResult {
  const recipientResult = parseTransferRecipient(recipientInput)
  const amount = amountInput.trim()
  const recipientError = recipientResult.ok ? undefined : recipientResult.recipientError
  let amountError: string | undefined

  if (!amount) {
    amountError = '请输入 ETH 数量'
  } else if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)) {
    amountError = '请输入最多 18 位小数的正数'
  }

  let value: bigint | undefined
  if (!amountError) {
    try {
      value = parseEther(amount)
      if (value <= BigInt(0)) amountError = '转账数量必须大于 0'
    } catch {
      amountError = 'ETH 数量无法解析'
    }
  }

  if (!recipientResult.ok || amountError || value === undefined) {
    return { ok: false, recipientError, amountError }
  }

  return { ok: true, recipient: recipientResult.recipient, value }
}
