import { describe, expect, it } from 'vitest'
import { parseTransferEnsName, TRANSFER_ENS_MAX_BYTES } from './transferEns'

describe('parseTransferEnsName', () => {
  it('trims and normalizes an ENS name', () => {
    expect(parseTransferEnsName('  Alice.ETH  ')).toEqual({ ok: true, name: 'alice.eth' })
  })

  it.each([
    ['', '请输入 ENS 名称'],
    ['alice', 'ENS 名称必须包含命名空间，例如 name.eth'],
    ['alice..eth', '请输入有效的 ENS 名称'],
    ['alice name.eth', '请输入有效的 ENS 名称'],
  ])('rejects invalid ENS input %#', (input, error) => {
    expect(parseTransferEnsName(input)).toEqual({ ok: false, error })
  })

  it('rejects a normalized name beyond the DNS byte boundary', () => {
    const longName = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.eth`
    expect(new TextEncoder().encode(longName).length).toBeGreaterThan(TRANSFER_ENS_MAX_BYTES)
    expect(parseTransferEnsName(longName)).toEqual({ ok: false, error: 'ENS 名称过长' })
  })
})
