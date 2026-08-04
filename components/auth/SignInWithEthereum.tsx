'use client'

import { useLogout } from '@/lib/hooks/useLogout'
import { useSession } from '@/lib/hooks/useSession'
import { useSiwe } from '@/lib/hooks/useSiwe'
import { truncateAddress } from '@/lib/format'
import { useConnection } from 'wagmi'
import { Button } from '@/components/ui/button'

export default function SignInWithEthereum() {
  const { isConnected } = useConnection()
  const { data: session, isLoading: isSessionLoading } = useSession()
  const { mutate: signIn, isPending: isSigningIn, isError, error } = useSiwe()
  const { mutate: signOut, isPending: isSigningOut } = useLogout()

  if (isSessionLoading) {
    return <p className="text-sm text-muted-foreground">检查登录状态…</p>
  }

  if (session) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs text-muted-foreground">已验证身份</p><p className="mt-1 font-mono text-sm text-emerald-300">{truncateAddress(session.address)}</p></div>
        <Button variant="outline" onClick={() => signOut()} disabled={isSigningOut}>
          {isSigningOut ? '退出中…' : '退出登录'}
        </Button>
      </div>
    )
  }

  if (!isConnected) {
    return <Button className="w-full" disabled>请先连接钱包</Button>
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={() => signIn()} disabled={isSigningIn}>
        {isSigningIn ? '请在钱包中确认签名…' : '使用以太坊登录'}
      </Button>
      {isError && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">{error.message}</p>
          <Button variant="ghost" onClick={() => signIn()}>重试</Button>
        </div>
      )}
    </div>
  )
}
