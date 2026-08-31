import { describe, expect, it } from 'vitest'
import {
  ADDRESS_BOOK_MAX_ENTRIES,
  addressBookStorageKey,
  loadAddressBook,
  removeAddressBookEntry,
  upsertAddressBookEntry,
} from './addressBookStorage'

const CHAIN_ID = 11155111
const OTHER_CHAIN_ID = 84532
const ADDRESS = '0x8f7b86fe8f1a5cab00aa66cbb3e3bbf6a79535ee'
const CHECKSUM_ADDRESS = '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('address book storage', () => {
  it('normalizes an entry and isolates it by chain ID', () => {
    const storage = memoryStorage()

    expect(upsertAddressBookEntry(storage, CHAIN_ID, { name: ' Alice ', address: ADDRESS })).toEqual({
      ok: true,
      entries: [{ name: 'Alice', address: CHECKSUM_ADDRESS }],
    })
    expect(loadAddressBook(storage, CHAIN_ID)).toEqual({
      ok: true,
      entries: [{ name: 'Alice', address: CHECKSUM_ADDRESS }],
    })
    expect(loadAddressBook(storage, OTHER_CHAIN_ID)).toEqual({ ok: true, entries: [] })
    expect(storage.values.has(addressBookStorageKey(CHAIN_ID))).toBe(true)
  })

  it('updates an existing address without creating a duplicate', () => {
    const storage = memoryStorage()
    upsertAddressBookEntry(storage, CHAIN_ID, { name: 'Alice', address: ADDRESS })

    expect(upsertAddressBookEntry(storage, CHAIN_ID, { name: 'Treasury', address: CHECKSUM_ADDRESS })).toEqual({
      ok: true,
      entries: [{ name: 'Treasury', address: CHECKSUM_ADDRESS }],
    })
  })

  it.each([
    [{ name: '', address: ADDRESS }, '请输入联系人名称'],
    [{ name: 'x'.repeat(41), address: ADDRESS }, '联系人名称不能超过 40 个字符'],
    [{ name: 'bad\nname', address: ADDRESS }, '联系人名称不能包含控制字符'],
    [{ name: 'Alice', address: 'not-an-address' }, '请输入有效的 EVM 地址'],
    [{ name: 'Alice', address: '0x0000000000000000000000000000000000000000' }, '不能向零地址转账'],
  ])('rejects invalid input %#', (input, error) => {
    const storage = memoryStorage()
    expect(upsertAddressBookEntry(storage, CHAIN_ID, input)).toEqual({ ok: false, entries: [], error })
    expect(storage.values.size).toBe(0)
  })

  it('fails closed and removes malformed or cross-chain records', () => {
    const storage = memoryStorage()
    storage.values.set(addressBookStorageKey(CHAIN_ID), JSON.stringify({
      version: 1,
      chainId: OTHER_CHAIN_ID,
      entries: [{ name: 'Alice', address: CHECKSUM_ADDRESS }],
    }))

    expect(loadAddressBook(storage, CHAIN_ID)).toEqual({
      ok: false,
      entries: [],
      error: '地址簿数据已损坏或版本不受支持，已忽略',
    })
    expect(storage.values.size).toBe(0)
  })

  it('rejects unknown fields, non-checksum persisted addresses, and duplicate persisted addresses', () => {
    const invalidEntries = [
      [{ name: 'Alice', address: CHECKSUM_ADDRESS, extra: true }],
      [{ name: 'Alice', address: ADDRESS }],
      [
        { name: 'Alice', address: CHECKSUM_ADDRESS },
        { name: 'Duplicate', address: CHECKSUM_ADDRESS },
      ],
    ]

    for (const entries of invalidEntries) {
      const storage = memoryStorage()
      storage.values.set(addressBookStorageKey(CHAIN_ID), JSON.stringify({ version: 1, chainId: CHAIN_ID, entries }))
      expect(loadAddressBook(storage, CHAIN_ID).ok).toBe(false)
      expect(storage.values.size).toBe(0)
    }
  })

  it('enforces the entry limit while still allowing updates', () => {
    const storage = memoryStorage()
    const entries = Array.from({ length: ADDRESS_BOOK_MAX_ENTRIES }, (_, index) => ({
      name: `Contact ${index}`,
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`,
    }))
    for (const entry of entries) expect(upsertAddressBookEntry(storage, CHAIN_ID, entry).ok).toBe(true)

    expect(upsertAddressBookEntry(storage, CHAIN_ID, {
      name: 'One too many',
      address: `0x${'f'.repeat(40)}`,
    })).toEqual({ ok: false, entries: [], error: '每条链最多保存 50 个联系人' })
    expect(upsertAddressBookEntry(storage, CHAIN_ID, {
      name: 'Updated',
      address: entries[0].address,
    })).toMatchObject({ ok: true })
  })

  it('removes only the requested entry and deletes an empty record', () => {
    const storage = memoryStorage()
    upsertAddressBookEntry(storage, CHAIN_ID, { name: 'Alice', address: ADDRESS })

    expect(removeAddressBookEntry(storage, CHAIN_ID, CHECKSUM_ADDRESS)).toEqual({ ok: true, entries: [] })
    expect(storage.values.has(addressBookStorageKey(CHAIN_ID))).toBe(false)
  })

  it('reports browser read and write failures without throwing', () => {
    expect(loadAddressBook({
      getItem: () => { throw new Error('blocked') },
      setItem: () => undefined,
      removeItem: () => undefined,
    }, CHAIN_ID)).toEqual({ ok: false, entries: [], error: '无法读取地址簿，请检查浏览器存储权限' })

    const storage = memoryStorage()
    expect(upsertAddressBookEntry({
      getItem: storage.getItem,
      setItem: () => { throw new Error('quota') },
      removeItem: storage.removeItem,
    }, CHAIN_ID, { name: 'Alice', address: ADDRESS })).toEqual({
      ok: false,
      entries: [],
      error: '无法保存地址簿，请检查浏览器存储权限或空间',
    })
  })
})
