import { describe, expect, it } from 'vitest'
import { parseEther, zeroAddress } from 'viem'
import { parseNativeTransferInput } from './nativeTransferInput'

const RECIPIENT = '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE'

describe('parseNativeTransferInput', () => {
  it('normalizes a valid address and parses ETH into wei', () => {
    expect(parseNativeTransferInput(` ${RECIPIENT.toLowerCase()} `, '0.0001')).toEqual({
      ok: true,
      recipient: RECIPIENT,
      value: parseEther('0.0001'),
    })
  })

  it.each([
    ['', '请输入收款地址'],
    ['not-an-address', '请输入有效的 EVM 地址'],
    [zeroAddress, '不能向零地址转账'],
  ])('rejects recipient %j', (recipient, message) => {
    expect(parseNativeTransferInput(recipient, '1')).toMatchObject({
      ok: false,
      recipientError: message,
    })
  })

  it.each([
    ['', '请输入 ETH 数量'],
    ['0', '转账数量必须大于 0'],
    ['-1', '请输入最多 18 位小数的正数'],
    ['1e-3', '请输入最多 18 位小数的正数'],
    ['0.1234567890123456789', '请输入最多 18 位小数的正数'],
  ])('rejects amount %j', (amount, message) => {
    expect(parseNativeTransferInput(RECIPIENT, amount)).toMatchObject({
      ok: false,
      amountError: message,
    })
  })
})
