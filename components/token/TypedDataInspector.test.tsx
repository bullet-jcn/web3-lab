import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TypedDataInspector } from './TypedDataInspector'

const mocks = vi.hoisted(() => ({ address: '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE' as `0x${string}` | undefined, chainId: 11155111, block: { timestamp: BigInt(2_000) } as { timestamp: bigint } | undefined, error: null as Error | null, refetch: vi.fn() }))
vi.mock('wagmi', () => ({ useConnection: () => ({ address: mocks.address, chainId: mocks.chainId }), useBlock: () => ({ data: mocks.block, error: mocks.error, isPending: !mocks.block, isFetching: false, refetch: mocks.refetch }) }))

describe('TypedDataInspector', () => {
  beforeEach(() => { mocks.address = '0x8F7b86Fe8f1a5CaB00Aa66cBb3E3BBF6a79535EE'; mocks.chainId = 11155111; mocks.block = { timestamp: BigInt(2_000) }; mocks.error = null; mocks.refetch.mockReset() })
  it('explains EIP-2612 domain, digest, permission effect, and deterministic risk', () => { render(<TypedDataInspector />); fireEvent.click(screen.getByRole('button', { name: '载入 EIP-2612 样例' })); fireEvent.click(screen.getByRole('button', { name: '解释 Typed Data' })); expect(screen.getByText('EIP-2612 Permit')).toBeInTheDocument(); expect(screen.getByText(/ERC-20 allowance 将被覆盖/)).toBeInTheDocument(); expect(screen.getByText(/检测到高风险/)).toBeInTheDocument() })
  it('explains Permit2 internal effect without claiming root allowance changes', () => { render(<TypedDataInspector />); fireEvent.click(screen.getByRole('button', { name: '载入 Permit2 PermitSingle 样例' })); fireEvent.click(screen.getByRole('button', { name: '解释 Typed Data' })); expect(screen.getByText('Permit2 PermitSingle')).toBeInTheDocument(); expect(screen.getByText(/底层 Token→Permit2 allowance 不变/)).toBeInTheDocument() })
  it('clears stale output on edit and reports invalid JSON', () => { render(<TypedDataInspector />); fireEvent.click(screen.getByRole('button', { name: '解释 Typed Data' })); expect(screen.getByText('Typed data 无效')).toBeInTheDocument(); fireEvent.change(screen.getByLabelText('Typed Data JSON'), { target: { value: '{bad' } }); expect(screen.queryByText('Typed data 无效')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: '解释 Typed Data' })); expect(screen.getByText('INVALID_JSON')).toBeInTheDocument() })
  it('discloses that it does not sign or persist raw typed data', () => { render(<TypedDataInspector />); expect(screen.getByText(/不保存原始 JSON 或签名/)).toBeInTheDocument() })
})
