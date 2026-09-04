import { PolicyPage } from '@/components/legal/PolicyPage'
import { readPublicServiceConfig } from '@/lib/publicServiceConfig'

export default function TermsPage() {
  const { operatorName, supportEmail } = readPublicServiceConfig()
  return (
    <PolicyPage eyebrow="Terms" title="服务条款">
      <section>
        <h2>服务性质</h2>
        <p>{operatorName} 提供非托管的钱包伴侣与交易安全界面。服务不会替用户保管私钥、恢复钱包或在没有钱包授权的情况下签署交易，也不是交易所、托管人、经纪商或投资顾问。</p>
      </section>
      <section>
        <h2>用户责任</h2>
        <ul>
          <li>核对钱包账户、网络、接收地址、合约、资产、金额、授权对象和钱包最终展示。</li>
          <li>保护设备、钱包、助记词、私钥及硬件钱包，并遵守所在地法律。</li>
          <li>理解交易广播后可能不可逆，Gas、价格、余额、Nonce 和合约状态可能在模拟后变化。</li>
        </ul>
      </section>
      <section>
        <h2>安全解释的限制</h2>
        <p>确定性规则只覆盖明确支持的链、资产、函数和风险模式。“未发现已知风险”不等于安全保证、审计结论或投资建议。AI 只能解释已有 finding，不能增加、删除或改变风险等级。</p>
      </section>
      <section>
        <h2>可用性与变更</h2>
        <p>钱包、RPC、区块链、数据库、Redis 和外部服务可能失败或延迟。服务会尽力诚实展示降级与结果未知状态，但不承诺永不中断。重大条款或数据处理变化会更新页面生效日期。</p>
      </section>
      <section>
        <h2>联系</h2>
        {supportEmail
          ? <p>服务问题：<a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
          : <p>本地构建尚未配置公开支持邮箱；未配置联系人时发布预检不会允许上线。</p>}
      </section>
    </PolicyPage>
  )
}
