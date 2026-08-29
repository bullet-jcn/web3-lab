import { getAddress, isAddress, parseEther, zeroAddress, type Address } from 'viem'

export type NativeTransferInputResult =
  | { ok: true; recipient: Address; value: bigint }
  | { ok: false; recipientError?: string; amountError?: string }

export function parseNativeTransferInput(
  recipientInput: string,
  amountInput: string,
): NativeTransferInputResult {
  const recipient = recipientInput.trim()
  const amount = amountInput.trim()
  let recipientError: string | undefined
  let amountError: string | undefined

  if (!recipient) {
    recipientError = '请输入收款地址'
  } else if (!isAddress(recipient)) {
    recipientError = '请输入有效的 EVM 地址'
  } else if (recipient.toLowerCase() === zeroAddress) {
    recipientError = '不能向零地址转账'
  }

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

  if (recipientError || amountError || value === undefined) {
    return { ok: false, recipientError, amountError }
  }

  return { ok: true, recipient: getAddress(recipient), value }
}
