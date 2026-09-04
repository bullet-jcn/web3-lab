import { PolicyPage } from '@/components/legal/PolicyPage'

export default function RiskDisclosurePage() {
  return (
    <PolicyPage eyebrow="Risk" title="链上操作风险披露">
      <section>
        <h2>非托管不等于无风险</h2>
        <p>密钥留在钱包中可以减少托管风险，但恶意签名、错误网络、错误地址、合约漏洞、无限授权、钓鱼界面和被攻陷的钱包仍可能造成不可逆损失。</p>
      </section>
      <section>
        <h2>模拟的边界</h2>
        <p>模拟只说明在指定区块状态与假设下调用是否能够执行。签名和真实打包之间，余额、授权、价格、Nonce、Gas、合约实现及链状态都可能改变，所以模拟成功不保证交易成功或经济结果符合预期。</p>
      </section>
      <section>
        <h2>交易状态</h2>
        <ul>
          <li>钱包返回 Hash 只表示已获得广播标识，不表示成功。</li>
          <li>Receipt success 表示 EVM 没有 revert，不自动证明业务目的正确。</li>
          <li>交易可能被加速、取消、替换、重组或长时间保持未知。</li>
          <li>顺序批量可能部分成功；后续失败不会回滚此前已确认交易。</li>
        </ul>
      </section>
      <section>
        <h2>授权与第三方</h2>
        <p>ERC-20、Permit 和 Permit2 授权可能在未来继续有效。知名合约也可能存在漏洞、管理员密钥风险或升级风险。只授权必要额度，不再使用时撤销，并通过独立来源核对合约地址。</p>
      </section>
      <section>
        <h2>覆盖声明</h2>
        <p>本服务报告支持范围内的已知 finding，不声称识别所有恶意合约、签名或经济攻击。超出 Registry、解码、模拟或数据源范围的内容会被标记为未知，而不是猜测安全。</p>
      </section>
    </PolicyPage>
  )
}
