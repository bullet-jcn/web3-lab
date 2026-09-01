import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalldataInspector } from './CalldataInspector'

describe('CalldataInspector', () => {
  it('explains a registered unlimited ERC-20 approval with deterministic risk evidence', () => {
    render(<CalldataInspector />)

    fireEvent.click(screen.getByRole('button', { name: '载入 ERC-20 approve 样例' }))
    fireEvent.click(screen.getByRole('button', { name: '解释这笔调用' }))

    expect(screen.getByText('ERC-20 approve')).toBeInTheDocument()
    expect(screen.getByText(/allowance 将被覆盖为\s*无限额度/)).toBeInTheDocument()
    expect(screen.getByText(/检测到高风险/)).toHaveTextContent('无限额度代币使用权')
    expect(screen.getByText('Web3 Lab 测试 Spender')).toBeInTheDocument()
  })

  it('explains the exact registered Permit2 lockdown effect and its untouched root layer', () => {
    render(<CalldataInspector />)

    fireEvent.click(screen.getByRole('button', { name: '载入 Permit2 lockdown 样例' }))
    fireEvent.click(screen.getByRole('button', { name: '解释这笔调用' }))

    expect(screen.getByText('Permit2 lockdown')).toBeInTheDocument()
    expect(screen.getByText(/#1 USD Coin/)).toHaveTextContent('Web3 Lab 测试 Spender')
    expect(screen.getByText(/内部 amount 将被清零/)).toHaveTextContent('底层 ERC-20 allowance 不会改变')
  })

  it('shows invalid input separately from unsupported coverage', () => {
    render(<CalldataInspector />)

    fireEvent.click(screen.getByRole('button', { name: '解释这笔调用' }))
    expect(screen.getByText('输入无效')).toBeInTheDocument()
    expect(screen.getByText('INVALID_TARGET')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Calldata 目标合约'), {
      target: { value: '0x0000000000000000000000000000000000000001' },
    })
    fireEvent.change(screen.getByLabelText('Calldata 内容'), { target: { value: '0x12345678' } })
    fireEvent.click(screen.getByRole('button', { name: '解释这笔调用' }))
    expect(screen.getByText('当前不支持解释')).toBeInTheDocument()
    expect(screen.getByText('UNSUPPORTED_CONTRACT')).toBeInTheDocument()
  })

  it('clears stale analysis whenever either input changes', () => {
    render(<CalldataInspector />)

    fireEvent.click(screen.getByRole('button', { name: '载入 ERC-20 approve 样例' }))
    fireEvent.click(screen.getByRole('button', { name: '解释这笔调用' }))
    expect(screen.getByText('ERC-20 approve')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Calldata 内容'), { target: { value: '0x12345678' } })
    expect(screen.queryByText('ERC-20 approve')).not.toBeInTheDocument()
  })

  it('states that decoding is not simulation and does not include native value', () => {
    render(<CalldataInspector />)

    expect(screen.getByText(/解码只说明 ABI 参数/)).toHaveTextContent('不证明调用会成功')
    expect(screen.getByText(/解码只说明 ABI 参数/)).toHaveTextContent('原生币 value')
  })
})
