'use client'

import { useSession } from '@/lib/hooks/useSession'
import { useWatchlist } from '@/lib/hooks/useWatchlist'
import { truncateAddress } from '@/lib/format'
import { Address, isAddress } from 'viem'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    return <p className="text-sm text-muted-foreground">登录后可以使用关注列表</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="0x..."
          value={addressInput}
          onChange={(e) => {
            setAddressInput(e.target.value)
            setFormatError('')
          }}
          className="flex-1 font-mono"
        />
        <Button onClick={handleAdd} disabled={isAdding || !isAddress(addressInput)}>
          {isAdding ? '添加中…' : '添加'}
        </Button>
      </div>
      {(formatError || addError?.message) && (
        <p className="text-sm text-destructive">{formatError || addError?.message}</p>
      )}

      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有关注任何地址</p>
      ) : (
        <ul className="space-y-1">
          {addresses.map((item: Address) => (
            <li key={item} className="flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-white/[0.025] px-3 py-2 text-sm">
              <span className="font-mono">{truncateAddress(item)}</span>
              <Button variant="ghost" disabled={isRemoving} onClick={() => removeAddress(item)}>移除</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
