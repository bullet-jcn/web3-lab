import type { Hash } from 'viem'
import { getTransactionExplorerUrl } from '@/lib/chains'

interface TransactionExplorerLinkProps {
  chainId: number | undefined
  hash: Hash | undefined
  label: string
}

export function TransactionExplorerLink({ chainId, hash, label }: TransactionExplorerLinkProps) {
  if (!hash) return null
  const href = getTransactionExplorerUrl(chainId, hash)
  if (!href) return null

  const shortHash = `${hash.slice(0, 10)}…${hash.slice(-8)}`

  return (
    <a
      className="block w-fit text-sm text-blue-600 underline underline-offset-4 hover:text-blue-500 dark:text-blue-400"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={hash}
      aria-label={`${label} ${hash}`}
    >
      {label}: <span className="font-mono">{shortHash}</span>
    </a>
  )
}
