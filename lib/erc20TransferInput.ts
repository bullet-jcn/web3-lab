import { maxUint256, parseUnits, type Address } from 'viem'
import { parseTransferRecipient } from './transferRecipient'

export type Erc20TransferInputResult =
  | { ok: true; recipient: Address; amount: bigint }
  | { ok: false; recipientError?: string; amountError?: string }

export function parseErc20TransferInput(
  recipientInput: string,
  amountInput: string,
  decimals: number | undefined,
): Erc20TransferInputResult {
  const recipientResult = parseTransferRecipient(recipientInput)
  const amount = amountInput.trim()
  const recipientError = recipientResult.ok ? undefined : recipientResult.recipientError
  let amountError: string | undefined

  if (decimals === undefined) {
    amountError = '正在读取代币精度'
  } else if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    amountError = '代币精度无效'
  } else if (!amount) {
    amountError = '请输入代币数量'
  } else {
    const amountPattern = decimals === 0
      ? /^(?:0|[1-9]\d*)$/
      : new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${decimals}})?$`)
    if (!amountPattern.test(amount)) {
      amountError = `请输入最多 ${decimals} 位小数的正数`
    }
  }

  let parsedAmount: bigint | undefined
  if (!amountError && decimals !== undefined) {
    try {
      parsedAmount = parseUnits(amount, decimals)
      if (parsedAmount <= BigInt(0)) amountError = '转账数量必须大于 0'
      if (parsedAmount > maxUint256) amountError = '转账数量超出 ERC-20 范围'
    } catch {
      amountError = '代币数量无法解析'
    }
  }

  if (!recipientResult.ok || amountError || parsedAmount === undefined) {
    return { ok: false, recipientError, amountError }
  }

  return { ok: true, recipient: recipientResult.recipient, amount: parsedAmount }
}
