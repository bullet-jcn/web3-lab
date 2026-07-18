export function getErrorMessage(error: Error | null): string | null {
  if (!error) return null

  const message = error.message

  if (message.includes('User rejected') || message.includes('User denied')) {
    return '你取消了这笔交易'
  }
  if (message.includes('insufficient funds')) {
    return 'gas不足，请到水龙头领取一些测试ETH'
  }
  if (message.includes('reverted')) {
    return '合约拒绝了这个操作，请检查参数或余额'
  }
  if (message.includes('gas limit too high') || message.includes('RPC submit')) {
    return 'Gas设置异常，请刷新页面重试'
  }

  return '转账失败，请重试'
}