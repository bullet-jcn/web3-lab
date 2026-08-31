import { describe, expect, it } from 'vitest'
import { resolveNativeMaxTransfer, resolveNativeTransferBudget } from './nativeTransferBudget'

describe('resolveNativeTransferBudget', () => {
  it('fails closed while any budget input is unknown', () => {
    expect(resolveNativeTransferBudget({
      value: BigInt(1),
      balance: BigInt(10),
      gas: undefined,
      maxFeePerGas: BigInt(2),
    })).toEqual({ state: 'unavailable' })
  })

  it('reserves gas at the max fee per gas', () => {
    expect(resolveNativeTransferBudget({
      value: BigInt(50),
      balance: BigInt(100),
      gas: BigInt(10),
      maxFeePerGas: BigInt(3),
    })).toEqual({
      state: 'sufficient',
      gasCostLimit: BigInt(30),
      required: BigInt(80),
      remaining: BigInt(20),
    })
  })

  it('rejects value that fits alone but leaves too little for gas', () => {
    expect(resolveNativeTransferBudget({
      value: BigInt(90),
      balance: BigInt(100),
      gas: BigInt(10),
      maxFeePerGas: BigInt(2),
    })).toEqual({
      state: 'insufficient',
      gasCostLimit: BigInt(20),
      required: BigInt(110),
      shortfall: BigInt(10),
    })
  })
})

describe('resolveNativeMaxTransfer', () => {
  it('fails closed while gas evidence is unavailable', () => {
    expect(resolveNativeMaxTransfer({
      balance: BigInt(100),
      gas: undefined,
      maxFeePerGas: BigInt(2),
    })).toEqual({ state: 'unavailable' })
  })

  it('subtracts the conservative gas limit from the native balance', () => {
    expect(resolveNativeMaxTransfer({
      balance: BigInt(100),
      gas: BigInt(10),
      maxFeePerGas: BigInt(3),
    })).toEqual({
      state: 'available',
      gasCostLimit: BigInt(30),
      value: BigInt(70),
    })
  })

  it('does not produce a zero or negative transfer value', () => {
    expect(resolveNativeMaxTransfer({
      balance: BigInt(30),
      gas: BigInt(10),
      maxFeePerGas: BigInt(3),
    })).toEqual({ state: 'no-transferable-balance', gasCostLimit: BigInt(30) })
  })
})
