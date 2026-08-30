import { getAddress, isAddress, maxUint256, parseUnits, zeroAddress, type Address } from 'viem'

export type Erc20TransferInputResult =
  | { ok: true; recipient: Address; amount: bigint }
  | { ok: false; recipientError?: string; amountError?: string }

export function parseErc20TransferInput(
  recipientInput: string,
  amountInput: string,
  decimals: number | undefined,
): Erc20TransferInputResult {
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

  if (recipientError || amountError || parsedAmount === undefined) {
    return { ok: false, recipientError, amountError }
  }

  return { ok: true, recipient: getAddress(recipient), amount: parsedAmount }
}
