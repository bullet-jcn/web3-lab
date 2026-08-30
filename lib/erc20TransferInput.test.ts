import { describe, expect, it } from 'vitest'
import { maxUint256, zeroAddress } from 'viem'
import { parseErc20TransferInput } from './erc20TransferInput'

const RECIPIENT = '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE'

describe('parseErc20TransferInput', () => {
  it('uses token decimals instead of assuming 18 decimals', () => {
    expect(parseErc20TransferInput(RECIPIENT.toLowerCase(), '1.25', 6)).toEqual({
      ok: true,
      recipient: RECIPIENT,
      amount: BigInt(1_250_000),
    })
  })

  it('waits for decimals before parsing an amount', () => {
    expect(parseErc20TransferInput(RECIPIENT, '1', undefined)).toMatchObject({
      ok: false,
      amountError: '正在读取代币精度',
    })
  })

  it('supports a zero-decimal token without accepting fractional input', () => {
    expect(parseErc20TransferInput(RECIPIENT, '2', 0)).toMatchObject({ ok: true, amount: BigInt(2) })
    expect(parseErc20TransferInput(RECIPIENT, '2.1', 0)).toMatchObject({
      ok: false,
      amountError: '请输入最多 0 位小数的正数',
    })
  })

  it('rejects precision beyond the token metadata', () => {
    expect(parseErc20TransferInput(RECIPIENT, '0.0000001', 6)).toMatchObject({
      ok: false,
      amountError: '请输入最多 6 位小数的正数',
    })
  })

  it('rejects zero address, zero amount, and uint256 overflow', () => {
    expect(parseErc20TransferInput(zeroAddress, '1', 6)).toMatchObject({
      ok: false,
      recipientError: '不能向零地址转账',
    })
    expect(parseErc20TransferInput(RECIPIENT, '0', 6)).toMatchObject({
      ok: false,
      amountError: '转账数量必须大于 0',
    })
    expect(parseErc20TransferInput(RECIPIENT, (maxUint256 + BigInt(1)).toString(), 0)).toMatchObject({
      ok: false,
      amountError: '转账数量超出 ERC-20 范围',
    })
  })
})
