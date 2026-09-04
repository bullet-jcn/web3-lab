import { describe, expect, it } from 'vitest'
import { clearBrowserServiceData } from './accountDeletion'

describe('browser service data deletion', () => {
  it('removes only this application namespace', () => {
    localStorage.setItem('web3-lab:pending-tx:v1:1:account:native-transfer', 'public hash')
    localStorage.setItem('web3-lab:address-book:v1:1', 'contact')
    localStorage.setItem('wallet-provider:connection', 'keep')

    expect(clearBrowserServiceData(localStorage)).toBe(2)
    expect(localStorage.getItem('web3-lab:pending-tx:v1:1:account:native-transfer')).toBeNull()
    expect(localStorage.getItem('web3-lab:address-book:v1:1')).toBeNull()
    expect(localStorage.getItem('wallet-provider:connection')).toBe('keep')
  })
})
