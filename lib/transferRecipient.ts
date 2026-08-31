import { getAddress, isAddress, zeroAddress, type Address } from 'viem'

export type TransferRecipientResult =
  | { ok: true; recipient: Address }
  | { ok: false; recipientError: string }

export function parseTransferRecipient(recipientInput: string): TransferRecipientResult {
  const recipient = recipientInput.trim()

  if (!recipient) return { ok: false, recipientError: '请输入收款地址' }
  if (!isAddress(recipient)) return { ok: false, recipientError: '请输入有效的 EVM 地址' }
  if (recipient.toLowerCase() === zeroAddress) return { ok: false, recipientError: '不能向零地址转账' }

  return { ok: true, recipient: getAddress(recipient) }
}
