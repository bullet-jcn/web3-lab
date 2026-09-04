export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE MY DATA'

type BrowserStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>

export function clearBrowserServiceData(storage: BrowserStorage): number {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith('web3-lab:')) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
  return keys.length
}
