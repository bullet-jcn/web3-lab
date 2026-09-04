import { PolicyPage } from '@/components/legal/PolicyPage'
import { readPublicServiceConfig } from '@/lib/publicServiceConfig'

export default function SupportPage() {
  const { supportEmail } = readPublicServiceConfig()
  return (
    <PolicyPage eyebrow="Support" title="支持与安全事件">
      <section>
        <h2>提交问题</h2>
        {supportEmail
          ? <p>请联系 <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>，附上发生时间、环境、页面、公开交易 Hash（如适用）和响应中的 Request ID。</p>
          : <p>本地构建尚未配置支持邮箱；正式发布必须先通过联系人配置门禁。</p>}
      </section>
      <section>
        <h2>绝不要发送</h2>
        <p>支持人员不需要助记词、私钥、Session Cookie、完整签名、未公开 calldata 或远程控制设备。任何索要这些内容的人都不应被信任。</p>
      </section>
      <section>
        <h2>分级目标</h2>
        <ul>
          <li>疑似密钥/会话泄露或错误写交易：作为安全事件立即分诊。</li>
          <li>认证、数据库、RPC 或交易观察持续不可用：按高优先级服务故障处理。</li>
          <li>一般功能、显示和文档问题：进入普通支持队列。</li>
        </ul>
        <p className="mt-2">响应时间是运营目标而非资金追回承诺。链上交易无法由支持人员撤销；发现异常授权时应立即在可信钱包或区块浏览器核对并撤销。</p>
      </section>
    </PolicyPage>
  )
}
