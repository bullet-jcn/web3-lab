'use client'

import { useSession } from '@/lib/hooks/useSession'
import { useWatchlist } from '@/lib/hooks/useWatchlist'
import { truncateAddress } from '@/lib/format'
import { Address, isAddress } from 'viem'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export default function WatchlistPanel() {
  const { data: session } = useSession()
  const { addresses, addAddress, isAdding, addError, removeAddress, isRemoving } = useWatchlist()
  const [addressInput, setAddressInput] = useState('')
  const [formatError, setFormatError] = useState('')

  function handleAdd() {
    if (!isAddress(addressInput)) {
      setFormatError('地址不正确')
      return
    }
    addAddress(addressInput)
    setAddressInput('')
    setFormatError('')
  }

  if (!session) {
    return <p className="text-sm text-gray-500 dark:text-neutral-400">登录后可以使用关注列表</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="0x..."
          value={addressInput}
          onChange={(e) => {
            setAddressInput(e.target.value)
            setFormatError('')
          }}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono dark:border-neutral-700 dark:bg-neutral-800"
        />
        <Button onClick={handleAdd} disabled={isAdding || !isAddress(addressInput)}>
          {isAdding ? '添加中…' : '添加'}
        </Button>
      </div>
      {(formatError || addError?.message) && (
        <p className="text-sm text-red-500">{formatError || addError?.message}</p>
      )}

      {addresses.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-neutral-400">还没有关注任何地址</p>
      ) : (
        <ul className="space-y-1">
          {addresses.map((item: Address) => (
            <li key={item} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono">{truncateAddress(item)}</span>
              <Button variant="ghost" disabled={isRemoving} onClick={() => removeAddress(item)}>移除</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
