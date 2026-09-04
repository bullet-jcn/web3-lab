'use client'

import { useState } from 'react'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/accountDeletion'
import { useDeleteAccount } from '@/lib/hooks/useDeleteAccount'
import { useLogout } from '@/lib/hooks/useLogout'
import { useWalletSession } from '@/lib/hooks/useWalletSession'
import { useSiwe } from '@/lib/hooks/useSiwe'
import { truncateAddress } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function SignInWithEthereum() {
  const { session, isConnected, status: sessionStatus, isLoading: isSessionLoading } = useWalletSession()
  const { mutate: signIn, isPending: isSigningIn, isError, error } = useSiwe()
  const { mutate: signOut, isPending: isSigningOut } = useLogout()
  const deleteAccount = useDeleteAccount()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  if (isSessionLoading) {
    return <p className="text-sm text-muted-foreground">检查登录状态…</p>
  }

  if (session && sessionStatus === 'matched') {
    return (
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs text-muted-foreground">已验证身份</p><p className="mt-1 font-mono text-sm text-emerald-300">{truncateAddress(session.address)}</p></div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => signOut()} disabled={isSigningOut || deleteAccount.isPending}>
            {isSigningOut ? '退出中…' : '退出登录'}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={isSigningOut || deleteAccount.isPending}>
            删除服务数据
          </Button>
        </div>

        <Dialog open={deleteOpen} onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setDeleteConfirmation('')
            deleteAccount.reset()
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>永久删除服务数据</DialogTitle>
              <DialogDescription>
                这会删除服务器上的会话、关注列表、交易意图和风险记录，并清除本设备的 web3-lab 恢复记录。公开区块链上的交易无法删除。
              </DialogDescription>
            </DialogHeader>
            <label className="space-y-2 text-sm">
              <span>输入 <code>{ACCOUNT_DELETION_CONFIRMATION}</code> 继续</span>
              <Input
                aria-label="账户删除确认"
                autoComplete="off"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
            </label>
            {deleteAccount.isError && (
              <p role="alert" className="text-sm text-destructive">{deleteAccount.error.message}</p>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
              <Button
                variant="destructive"
                disabled={deleteConfirmation !== ACCOUNT_DELETION_CONFIRMATION || deleteAccount.isPending}
                onClick={() => deleteAccount.mutate(deleteConfirmation)}
              >
                {deleteAccount.isPending ? '删除中…' : '永久删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (session && sessionStatus !== 'matched') {
    const message = sessionStatus === 'account-mismatch'
      ? '当前钱包与已登录账户不一致，请退出旧会话后重新登录。'
      : '钱包已断开；为保护已登录账户，请重新连接原钱包或退出登录。'

    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" onClick={() => signOut()} disabled={isSigningOut}>
          {isSigningOut ? '退出中…' : '退出旧会话'}
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
