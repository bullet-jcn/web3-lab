import { describe, expect, it, vi } from 'vitest'
import { readTransferRecipientFromClipboard } from './transferClipboard'

describe('readTransferRecipientFromClipboard', () => {
  it('normalizes a valid pasted address to checksum form', async () => {
    const clipboard = { readText: vi.fn().mockResolvedValue('  0x8f7b86fe8f1a5cab00aa66cbb3e3bbf6a79535ee\n') }

    await expect(readTransferRecipientFromClipboard(clipboard)).resolves.toEqual({
      ok: true,
      recipient: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE',
    })
  })

  it('rejects invalid and zero addresses without returning clipboard text', async () => {
    await expect(readTransferRecipientFromClipboard({
      readText: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000'),
    })).resolves.toEqual({ ok: false, error: '剪贴板内容无效：不能向零地址转账' })

    await expect(readTransferRecipientFromClipboard({
      readText: vi.fn().mockResolvedValue('not-an-address'),
    })).resolves.toEqual({ ok: false, error: '剪贴板内容无效：请输入有效的 EVM 地址' })
  })

  it('fails safely when clipboard access is unavailable or denied', async () => {
    await expect(readTransferRecipientFromClipboard(undefined)).resolves.toEqual({
      ok: false,
      error: '无法读取剪贴板，请手动粘贴地址',
    })
    await expect(readTransferRecipientFromClipboard({
      readText: vi.fn().mockRejectedValue(new Error('permission denied')),
    })).resolves.toEqual({ ok: false, error: '无法读取剪贴板，请手动粘贴地址' })
  })

  it('rejects unexpectedly large clipboard text before address parsing', async () => {
    await expect(readTransferRecipientFromClipboard({
      readText: vi.fn().mockResolvedValue('a'.repeat(257)),
    })).resolves.toEqual({ ok: false, error: '剪贴板内容不是有效的收款地址' })
  })
})
