'use client'

import { useLogout } from '@/lib/hooks/useLogout'
import { useSession } from '@/lib/hooks/useSession'
import { useSiwe } from '@/lib/hooks/useSiwe'
import { useConnection } from 'wagmi'

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function SignInWithEthereum() {
  const { isConnected } = useConnection()
  const { data: session, isLoading: isSessionLoading } = useSession()
  const { mutate: signIn, isPending: isSigningIn, isError, error } = useSiwe()
  const { mutate: signOut, isPending: isSigningOut } = useLogout()

  if (isSessionLoading) {
    return <p>检查登录状态…</p>
  }

  if (session) {
    return (
      <div>
        <p className="font-mono text-sm">已登录: {truncateAddress(session.address)}</p>
        <button onClick={() => signOut()} disabled={isSigningOut}>
          {isSigningOut ? '退出中…' : '退出登录'}
        </button>
      </div>
    )
  }

  if (!isConnected) {
    return <button disabled>请先连接钱包</button>
  }

  return (
    <div>
      <button onClick={() => signIn()} disabled={isSigningIn}>
        {isSigningIn ? '请在钱包中确认签名…' : '使用以太坊登录'}
      </button>
      {isError && (
        <div>
          <p className="text-red-500">{error.message}</p>
          <button onClick={() => signIn()}>重试</button>
        </div>
      )}
    </div>
  )
}
