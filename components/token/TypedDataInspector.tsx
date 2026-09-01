'use client'

import { useState } from 'react'
import { useBlock, useConnection } from 'wagmi'
import { Button } from '../ui/button'
import { WRITE_CHAIN } from '@/lib/chains'
import { DEMO_RECIPIENT_A } from '@/lib/constants'
import { analyzeTypedDataJson, createEip2612Sample, createPermit2Sample, MAX_TYPED_DATA_BYTES, type TypedDataAnalysisResult } from '@/lib/typedDataAnalysis'
import { formatDeterministicRiskWarning } from '@/lib/riskCheck'

export function TypedDataInspector() {
  const { address, chainId } = useConnection()
  const { data: block, error: blockError, isPending: isBlockPending, refetch, isFetching } = useBlock({ chainId: WRITE_CHAIN.id, query: { enabled: true } })
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState<TypedDataAnalysisResult | null>(null)
  const sampleDeadline = (block?.timestamp ?? BigInt(2_000_000_000)) + BigInt(3_600)

  function replace(value: string) { setRaw(value); setResult(null) }
  function inspect() { setResult(analyzeTypedDataJson({ raw, activeAccount: address, activeChainId: chainId, observedAt: block?.timestamp })) }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">确定性 EIP-712 Typed Data 解码</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">当前支持已核验 Sepolia USDC EIP-2612 Permit 与 canonical Permit2 PermitSingle；不会请求签名。</p>
      </div>
      <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">
        Typed data 签名可能被第三方提交上链。这里只解释消息与 domain，不保存原始 JSON 或签名，也不把“可哈希”当成“值得签署”。
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => replace(createEip2612Sample(address ?? DEMO_RECIPIENT_A, WRITE_CHAIN.id, sampleDeadline))}>载入 EIP-2612 样例</Button>
        <Button variant="outline" size="sm" onClick={() => replace(createPermit2Sample(WRITE_CHAIN.id, sampleDeadline))}>载入 Permit2 PermitSingle 样例</Button>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? '区块刷新中…' : '刷新链上时间'}</Button>
      </div>
      <textarea aria-label="Typed Data JSON" className="min-h-72 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" value={raw} onChange={(event) => { setRaw(event.target.value); setResult(null) }} placeholder="粘贴 EIP-712 JSON" maxLength={MAX_TYPED_DATA_BYTES} spellCheck={false} />
      <Button onClick={inspect}>解释 Typed Data</Button>
      {(isBlockPending || blockError) && <p className="text-xs text-orange-700 dark:text-orange-300">{blockError ? '链上时间读取失败：仍可解析，但不能判断 deadline 是否过期。' : '正在读取链上时间…'}</p>}
      {result && result.status !== 'decoded' && <div className={result.status === 'invalid' ? 'rounded-md bg-red-500/10 p-3 text-sm text-destructive' : 'rounded-md bg-orange-50 p-3 text-sm text-orange-700 dark:bg-orange-950 dark:text-orange-300'}><p className="font-medium">{result.status === 'invalid' ? 'Typed data 无效' : '当前不支持解释'}</p><p className="mt-1 text-xs">{result.message}</p><p className="mt-1 font-mono text-[10px]">{result.code}</p></div>}
      {result?.status === 'decoded' && (
        <div className="space-y-3 rounded-md border border-foreground/10 p-3 text-sm">
          <p className="font-medium">{result.call.kind === 'eip2612-permit' ? 'EIP-2612 Permit' : 'Permit2 PermitSingle'}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Domain chain</dt><dd>{result.call.chainId}</dd>
            <dt className="text-muted-foreground">Verifying contract</dt><dd className="break-all font-mono">{result.call.verifyingContract}</dd>
            <dt className="text-muted-foreground">Digest</dt><dd className="break-all font-mono">{result.call.digest}</dd>
            <dt className="text-muted-foreground">Token</dt><dd>{result.call.asset.name} ({result.call.asset.symbol})</dd>
            {'owner' in result.call && <><dt className="text-muted-foreground">Owner</dt><dd className="break-all font-mono">{result.call.owner}</dd></>}
            <dt className="text-muted-foreground">Spender</dt><dd className="break-all font-mono">{result.call.spender}</dd>
            {result.call.spenderLabel && <><dt className="text-muted-foreground">登记标签</dt><dd>{result.call.spenderLabel}</dd></>}
            <dt className="text-muted-foreground">授权额度</dt><dd>{result.call.isUnlimited ? '无限额度' : `${'formattedValue' in result.call ? result.call.formattedValue : result.call.formattedAmount} ${result.call.asset.symbol}`}</dd>
            <dt className="text-muted-foreground">Nonce</dt><dd>{result.call.nonce.toString()}</dd>
            {'deadline' in result.call ? <><dt className="text-muted-foreground">Deadline</dt><dd>{result.call.deadline.toString()}</dd></> : <><dt className="text-muted-foreground">权限到期</dt><dd>{result.call.expiration.toString()}</dd><dt className="text-muted-foreground">签名到期</dt><dd>{result.call.sigDeadline.toString()}</dd></>}
          </dl>
          <p>如果签名随后被有效提交：{result.call.kind === 'eip2612-permit' ? 'ERC-20 allowance 将被覆盖为上述额度。' : 'Permit2 内部 amount/expiration 将按消息设置；底层 Token→Permit2 allowance 不变。'}</p>
          {result.call.riskFindings.length === 0 ? <p className="text-emerald-700 dark:text-emerald-300">未命中当前确定性规则；这不代表绝对安全。</p> : <p className="whitespace-pre-line rounded-md bg-red-500/10 p-2 text-red-700 dark:text-red-300">{formatDeterministicRiskWarning(result.call.riskFindings)}</p>}
        </div>
      )}
    </div>
  )
}
