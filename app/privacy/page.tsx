import { PolicyPage } from '@/components/legal/PolicyPage'
import { readPublicServiceConfig } from '@/lib/publicServiceConfig'

export default function PrivacyPage() {
  const { operatorName, supportEmail } = readPublicServiceConfig()
  return (
    <PolicyPage eyebrow="Privacy" title="隐私政策">
      <section>
        <h2>运营方与范围</h2>
        <p>{operatorName} 运营本服务。本政策说明 Web3 Sentinel 在连接钱包、建立 SIWE Session、保存关注列表和提供交易安全功能时处理哪些服务端与浏览器数据。</p>
      </section>
      <section>
        <h2>我们处理的数据</h2>
        <ul>
          <li>公开钱包地址、Chain ID，以及 SIWE 验证过程中短暂处理的消息与签名。</li>
          <li>数据库中的 Session token hash、Watchlist、最小交易意图/Receipt 标识和确定性风险 finding code。</li>
          <li>浏览器本地保存的地址簿、公开交易 Hash、批次 ID 和恢复状态。</li>
          <li>脱敏的请求 ID、固定 Route、状态码、延迟、依赖类别、环境和 Release ID。</li>
        </ul>
        <p className="mt-2">我们不要求或保存助记词、私钥，也不长期保存原始签名、完整 calldata、typed data、Cookie、AI 提示词或异常正文。</p>
      </section>
      <section>
        <h2>用途与第三方</h2>
        <p>这些数据用于身份认证、跨设备 Watchlist、交易恢复、安全解释、滥用防护和故障运营。RPC Provider、WalletConnect、托管/监控服务与 AI 解释提供商只接收完成其职责所需的数据；AI 不决定风险等级。</p>
      </section>
      <section>
        <h2>保留与删除</h2>
        <ul>
          <li>过期或撤销 Session：在失效后保留最多 30 天。</li>
          <li>未广播的废弃交易意图：最后更新后最多 30 天。</li>
          <li>交易/Receipt 与确定性风险历史：最多 365 天。</li>
          <li>Watchlist 与账户关联：保留至用户主动删除服务数据。</li>
        </ul>
        <p className="mt-2">已登录用户可在身份区域选择“删除服务数据”。删除会清除服务端账户关联记录和本浏览器的 `web3-lab:*` 数据。区块链是公开独立网络，运营方不能删除已经上链的交易、Event 或地址活动。</p>
      </section>
      <section>
        <h2>联系</h2>
        {supportEmail
          ? <p>隐私、访问或删除请求：<a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
          : <p>本地构建尚未配置公开支持邮箱；未配置联系人时发布预检不会允许上线。</p>}
      </section>
    </PolicyPage>
  )
}
