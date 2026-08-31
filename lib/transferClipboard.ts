import type { Address } from 'viem'
import { parseTransferRecipient } from './transferRecipient'

export interface ClipboardTextReader {
  readText(): Promise<string>
}

export type ClipboardRecipientResult =
  | { ok: true; recipient: Address }
  | { ok: false; error: string }

const MAX_CLIPBOARD_TEXT_LENGTH = 256

export async function readTransferRecipientFromClipboard(
  clipboard: ClipboardTextReader | undefined,
): Promise<ClipboardRecipientResult> {
  if (!clipboard) return { ok: false, error: '无法读取剪贴板，请手动粘贴地址' }

  let text: string
  try {
    text = await clipboard.readText()
  } catch {
    return { ok: false, error: '无法读取剪贴板，请手动粘贴地址' }
  }

  if (typeof text !== 'string' || text.length > MAX_CLIPBOARD_TEXT_LENGTH) {
    return { ok: false, error: '剪贴板内容不是有效的收款地址' }
  }

  const recipient = parseTransferRecipient(text)
  if (!recipient.ok) {
    return { ok: false, error: `剪贴板内容无效：${recipient.recipientError}` }
  }

  return { ok: true, recipient: recipient.recipient }
}
