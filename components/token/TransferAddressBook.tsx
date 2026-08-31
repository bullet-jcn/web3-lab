import { useEffect, useState } from 'react'
import type { AddressBookEntry } from '@/lib/addressBookStorage'
import {
  loadAddressBook,
  removeAddressBookEntry,
  upsertAddressBookEntry,
} from '@/lib/addressBookStorage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TransferAddressBookProps {
  chainId: number
  chainName: string
  selectionDisabled: boolean
  onSelectErc20: (address: AddressBookEntry['address']) => void
  onSelectNative: (address: AddressBookEntry['address']) => void
}

export function TransferAddressBook({
  chainId,
  chainName,
  selectionDisabled,
  onSelectErc20,
  onSelectNative,
}: TransferAddressBookProps) {
  const [entries, setEntries] = useState<AddressBookEntry[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [storageError, setStorageError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const result = loadAddressBook(window.localStorage, chainId)
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setEntries(result.entries)
      setStorageError(result.ok ? null : result.error)
      setName('')
      setAddress('')
      setIsLoaded(true)
    })
    return () => { cancelled = true }
  }, [chainId])

  function saveEntry() {
    const result = upsertAddressBookEntry(window.localStorage, chainId, { name, address })
    if (!result.ok) {
      setStorageError(result.error)
      return
    }
    setEntries(result.entries)
    setStorageError(null)
    setName('')
    setAddress('')
  }

  function removeEntry(entry: AddressBookEntry) {
    const result = removeAddressBookEntry(window.localStorage, chainId, entry.address)
    if (!result.ok) {
      setStorageError(result.error)
      return
    }
    setEntries(result.entries)
    setStorageError(null)
  }

  return (
    <section className="space-y-3 rounded-md border border-border p-3" aria-labelledby="transfer-address-book-title">
      <div className="space-y-1">
        <h3 id="transfer-address-book-title" className="text-sm font-semibold">{chainName} 地址簿</h3>
        <p className="text-xs text-muted-foreground">
          联系人只保存在此浏览器，并且只属于 chainId {chainId}。选择联系人只会填表，不会自动打开钱包。
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="address-book-name">联系人名称</label>
          <Input
            id="address-book-name"
            value={name}
            onChange={(event) => { setName(event.target.value); setStorageError(null) }}
            maxLength={40}
            autoComplete="off"
            placeholder="例如：备用钱包"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="address-book-address">联系人地址</label>
          <Input
            id="address-book-address"
            value={address}
            onChange={(event) => { setAddress(event.target.value); setStorageError(null) }}
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
          />
        </div>
        <Button type="button" variant="outline" onClick={saveEntry}>保存联系人</Button>
      </div>

      {storageError && <p className="text-sm text-destructive" role="alert">{storageError}</p>}
      {!isLoaded && <p className="text-sm text-muted-foreground">正在读取地址簿…</p>}
      {isLoaded && entries.length === 0 && <p className="text-sm text-muted-foreground">当前链还没有联系人。</p>}
      {entries.length > 0 && (
        <ul className="space-y-2" aria-label={`${chainName} 联系人`}>
          {entries.map((entry) => (
            <li key={entry.address.toLowerCase()} className="space-y-2 rounded-md bg-muted/50 p-2">
              <div>
                <p className="text-sm font-medium">{entry.name}</p>
                <p className="break-all font-mono text-xs text-muted-foreground">{entry.address}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-label={`将 ${entry.name} 用于 ERC-20`}
                  onClick={() => onSelectErc20(entry.address)}
                  disabled={selectionDisabled}
                >用于 ERC-20</Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-label={`将 ${entry.name} 用于 ETH`}
                  onClick={() => onSelectNative(entry.address)}
                  disabled={selectionDisabled}
                >用于 ETH</Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={`删除联系人 ${entry.name}`}
                  onClick={() => removeEntry(entry)}
                >删除</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
