import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('returns null when there is no error', () => {
    expect(getErrorMessage(null)).toBe(null)
  })

  it('returns "你取消了这笔交易" when the message includes "User rejected"', () => {
    expect(getErrorMessage(new Error('User rejected the request'))).toBe('你取消了这笔交易')
  })

  it('returns "你取消了这笔交易" when the message includes "User denied"', () => {
    expect(getErrorMessage(new Error('User denied transaction signature'))).toBe('你取消了这笔交易')
  })

  it('returns the gas-faucet message when the message includes "insufficient funds"', () => {
    expect(getErrorMessage(new Error('insufficient funds for gas'))).toBe('gas不足，请到水龙头领取一些测试ETH')
  })

  it('returns the reverted-contract message when the message includes "reverted"', () => {
    expect(getErrorMessage(new Error('execution reverted'))).toBe('合约拒绝了这个操作，请检查参数或余额')
  })

  it('returns the gas-config message when the message includes "gas limit too high"', () => {
    expect(getErrorMessage(new Error('gas limit too high'))).toBe('Gas设置异常，请刷新页面重试')
  })

  it('returns the gas-config message when the message includes "RPC submit"', () => {
    expect(getErrorMessage(new Error('RPC submit failed'))).toBe('Gas设置异常，请刷新页面重试')
  })

  it('falls back to the generic retry message for an unrecognized error', () => {
    expect(getErrorMessage(new Error('some unexpected error'))).toBe('转账失败，请重试')
  })
})
