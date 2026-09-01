'use client'

import { useRef, useState } from 'react'
import { encodeFunctionData, erc20Abi, formatUnits, maxUint256, type Hex } from 'viem'
import { useConnection, usePublicClient } from 'wagmi'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { WRITE_CHAIN } from '@/lib/chains'
import {
  analyzeCalldata,
  MAX_CALLDATA_BYTES,
  type CalldataAnalysisResult,
} from '@/lib/calldataAnalysis'
import { SEPOLIA_USDC_ASSET } from '@/lib/assetRegistry'
import { DEMO_SPENDER_ADDRESS } from '@/lib/constants'
import { permit2AllowanceAbi } from '@/lib/permit2'
import { CANONICAL_PERMIT2_ADDRESS } from '@/lib/permit2Registry'
import { formatDeterministicRiskWarning } from '@/lib/riskCheck'

function unlimitedApproveSample() {
  return {
    to: SEPOLIA_USDC_ASSET.address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [DEMO_SPENDER_ADDRESS, maxUint256],
    }),
  }
}

function permit2LockdownSample() {
  return {
    to: CANONICAL_PERMIT2_ADDRESS,
    data: encodeFunctionData({
      abi: permit2AllowanceAbi,
      functionName: 'lockdown',
      args: [[{ token: SEPOLIA_USDC_ASSET.address, spender: DEMO_SPENDER_ADDRESS }]],
    }),
  }
}

export function CalldataInspector() {
  const { address } = useConnection()
  const publicClient = usePublicClient({ chainId: WRITE_CHAIN.id })
  const [target, setTarget] = useState('')
  const [calldata, setCalldata] = useState('')
  const [result, setResult] = useState<CalldataAnalysisResult | null>(null)
  const [simulation, setSimulation] = useState<{ status: 'running' | 'error' } | { status: 'success'; blockNumber: bigint; lines: readonly string[] } | null>(null)
  const requestId = useRef(0)

  function replaceInput(next: { readonly to: string; readonly data: string }) {
    setTarget(next.to)
    setCalldata(next.data)
    setResult(null)
    setSimulation(null)
    requestId.current += 1
  }

  function updateTarget(value: string) {
    setTarget(value)
    setResult(null)
    setSimulation(null)
    requestId.current += 1
  }

  function updateCalldata(value: string) {
    setCalldata(value)
    setResult(null)
    setSimulation(null)
    requestId.current += 1
  }

  function inspect() {
    const next = analyzeCalldata({ chainId: WRITE_CHAIN.id, to: target, data: calldata })
    setResult(next)
    setSimulation(null)
    const id = ++requestId.current
    if (next.status !== 'decoded' || !address || !publicClient) return
    setSimulation({ status: 'running' })
    void (async () => {
      try {
        const blockNumber = await publicClient.getBlockNumber()
        await publicClient.call({ account: address, to: next.call.target, data: calldata.trim() as Hex, blockNumber })
        const lines: string[] = []
        if (next.call.kind === 'erc20-approve') {
          const current = await publicClient.readContract({ address: next.call.asset.address, abi: erc20Abi, functionName: 'allowance', args: [address, next.call.spender], blockNumber })
          lines.push(`ERC-20 allowance：${formatUnits(current, next.call.asset.decimals)} → ${next.call.formattedAmount} ${next.call.asset.symbol}`)
        } else {
          const current = await Promise.all(next.call.pairs.map((pair) => publicClient.readContract({ address: next.call.target, abi: permit2AllowanceAbi, functionName: 'allowance', args: [address, pair.token, pair.spender], blockNumber })))
          current.forEach(([amount], index) => lines.push(`Permit2 #${index + 1} amount：${amount.toString()} → 0`))
        }
        lines.push('Token / 原生币余额：按该函数语义不转移资产（实际交易仍会消耗 Gas）')
        if (requestId.current === id) setSimulation({ status: 'success', blockNumber, lines })
      } catch {
        if (requestId.current === id) setSimulation({ status: 'error' })
      }
    })()
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">确定性 Calldata 解码</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          当前只支持 {WRITE_CHAIN.name} Registry 中的 ERC-20 approve 与 canonical Permit2 lockdown。未知内容不会交给 AI 猜测。
        </p>
      </div>

      <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">
        解码只说明 ABI 参数和“调用成功时”的预期权限效果，不证明调用会成功，也不包含交易可能附带的原生币 value。真实签名前仍需绑定账户、链、value 并模拟完整请求。
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => replaceInput(unlimitedApproveSample())}>
          载入 ERC-20 approve 样例
        </Button>
        <Button variant="outline" size="sm" onClick={() => replaceInput(permit2LockdownSample())}>
          载入 Permit2 lockdown 样例
        </Button>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">目标合约（to）</span>
        <Input
          aria-label="Calldata 目标合约"
          value={target}
          onChange={(event) => updateTarget(event.target.value)}
          placeholder="0x…"
          spellCheck={false}
        />
      </label>

      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">Calldata（最多 {MAX_CALLDATA_BYTES} bytes）</span>
        <textarea
          aria-label="Calldata 内容"
          className="min-h-28 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          value={calldata}
          onChange={(event) => updateCalldata(event.target.value)}
          placeholder="0x…"
          maxLength={MAX_CALLDATA_BYTES * 2 + 2}
          spellCheck={false}
        />
      </label>

      <Button onClick={inspect}>解释这笔调用</Button>

      {result?.status === 'decoded' && !address && <p className="text-xs text-orange-700 dark:text-orange-300">连接钱包后可按该账户执行同区块 eth_call 与当前权限读取。</p>}
      {simulation?.status === 'running' && <p className="text-xs text-muted-foreground">正在同一区块模拟调用并读取权限证据…</p>}
      {simulation?.status === 'error' && <p className="text-xs text-destructive">完整请求 eth_call 或权限读取失败；不能宣称该调用当前可执行。</p>}
      {simulation?.status === 'success' && <div className="rounded-md bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300"><p className="font-medium">eth_call 未 revert · block {simulation.blockNumber.toString()}</p>{simulation.lines.map((line) => <p key={line} className="mt-1">{line}</p>)}</div>}

      {result && result.status !== 'decoded' && (
        <div className={result.status === 'invalid'
          ? 'rounded-md bg-red-500/10 p-3 text-sm text-destructive'
          : 'rounded-md bg-orange-50 p-3 text-sm text-orange-700 dark:bg-orange-950 dark:text-orange-300'}>
          <p className="font-medium">{result.status === 'invalid' ? '输入无效' : '当前不支持解释'}</p>
          <p className="mt-1 text-xs leading-5">{result.message}</p>
          <p className="mt-1 font-mono text-[10px]">{result.code}</p>
        </div>
      )}

      {result?.status === 'decoded' && result.call.kind === 'erc20-approve' && (
        <div className="space-y-2 rounded-md border border-foreground/10 p-3 text-sm">
          <p className="font-medium">ERC-20 approve</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">网络</dt><dd>{WRITE_CHAIN.name} ({result.call.chainId})</dd>
            <dt className="text-muted-foreground">Token</dt><dd>{result.call.asset.name} ({result.call.asset.symbol})</dd>
            <dt className="text-muted-foreground">合约</dt><dd className="break-all font-mono">{result.call.target}</dd>
            <dt className="text-muted-foreground">Spender</dt><dd className="break-all font-mono">{result.call.spender}</dd>
            {result.call.spenderLabel && <><dt className="text-muted-foreground">登记标签</dt><dd>{result.call.spenderLabel}</dd></>}
          </dl>
          {result.call.effect === 'revoke' ? (
            <p className="text-emerald-700 dark:text-emerald-300">如果调用成功：该 spender 的 ERC-20 allowance 将被覆盖为 0。</p>
          ) : (
            <p>如果调用成功：allowance 将被覆盖为 {result.call.isUnlimited ? '无限额度（uint256 最大值）' : `${result.call.formattedAmount} ${result.call.asset.symbol}`}。</p>
          )}
          {result.call.riskFindings.length > 0 && (
            <p className="rounded-md bg-red-500/10 p-2 text-red-700 dark:text-red-300">
              {formatDeterministicRiskWarning(result.call.riskFindings)}
            </p>
          )}
        </div>
      )}

      {result?.status === 'decoded' && result.call.kind === 'permit2-lockdown' && (
        <div className="space-y-2 rounded-md border border-foreground/10 p-3 text-sm">
          <p className="font-medium">Permit2 lockdown</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{result.call.target}</p>
          {result.call.effect === 'no-op' ? (
            <p className="text-orange-700 dark:text-orange-300">Tuple 数组为空：调用可以被解码，但没有权限目标需要清除。</p>
          ) : (
            <div className="space-y-2">
              {result.call.pairs.map((pair, index) => (
                <div key={`${pair.targetId}:${index}`} className="rounded-md bg-foreground/5 p-2 text-xs">
                  <p className="font-medium">#{index + 1} {pair.tokenName} ({pair.symbol}) → {pair.spenderLabel}</p>
                  <p className="mt-1 break-all font-mono text-muted-foreground">Token: {pair.token}</p>
                  <p className="break-all font-mono text-muted-foreground">Spender: {pair.spender}</p>
                </div>
              ))}
              <p className="text-emerald-700 dark:text-emerald-300">
                如果调用成功：以上 Permit2 内部 amount 将被清零；Token→Permit2 底层 ERC-20 allowance 不会改变。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
