'use client'

import { useSession } from '@/lib/hooks/useSession'
import { useWatchlist } from '@/lib/hooks/useWatchlist'
import { truncateAddress } from '@/lib/format'
import { Address, isAddress } from 'viem'
import { useState } from 'react'

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
    return <p>登录后可以使用关注列表</p>
  }

  return (
    <div>
      <div>
        <input
          type="text"
          value={addressInput}
          onChange={(e) => {
            setAddressInput(e.target.value)
            setFormatError('')
          }}
        />
        <button onClick={handleAdd} disabled={isAdding || !isAddress(addressInput)}>
          {isAdding ? '添加中…' : '添加'}
        </button>
        <p className="text-red-500">{formatError || addError?.message}</p>
      </div>

      {addresses.length === 0 ? (
        <p>还没有关注任何地址</p>
      ) : (
        addresses.map((item: Address) => (
          <div key={item}>
            <p>{truncateAddress(item)}</p>
            <button disabled={isRemoving} onClick={() => removeAddress(item)}>移除</button>
          </div>
        ))
      )}
    </div>
  )
}
