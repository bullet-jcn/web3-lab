import { normalize } from 'viem/ens'

export const TRANSFER_ENS_MAX_BYTES = 255

export type TransferEnsNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string }

export function parseTransferEnsName(input: string): TransferEnsNameResult {
  const candidate = input.trim()
  if (!candidate) return { ok: false, error: '请输入 ENS 名称' }
  if (!candidate.includes('.')) return { ok: false, error: 'ENS 名称必须包含命名空间，例如 name.eth' }

  try {
    const name = normalize(candidate)
    if (new TextEncoder().encode(name).length > TRANSFER_ENS_MAX_BYTES) {
      return { ok: false, error: 'ENS 名称过长' }
    }
    return { ok: true, name }
  } catch {
    return { ok: false, error: '请输入有效的 ENS 名称' }
  }
}
