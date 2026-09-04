# Web3 Lab 学习进度

这份文件是跨对话恢复点。每完成一个学习步骤后更新，避免聊天连接或上下文压缩失败造成进度丢失。

## 当前目标

Milestone 2 / Batch C 与 Milestone 3 的支持范围代码实现和自动化退出审计已经完成。按用户决定，学习暂缓但不删除。Milestone 4 后端与运维继续代码优先：PostgreSQL/Redis、认证/Watchlist、RPC resilience、可观测性、依赖/密钥扫描治理以及部署环境/回滚边界已实现；第一至五批已提交，第六批代码已完成验证，下一批进入备份与数据政策。

Milestone 4 对用户属于新的知识领域，已建立独立延后课程 `docs/learning/MILESTONE_4_COURSE.md`。当前优先完成项目；用户下次要求“学习第四阶段”时从该课程第 1 课开始，用具象场景 → 业界边界 → 项目代码 → 小练习的顺序讲解。第四批可观测性已经完成；第五批把已知依赖公告归零并建立 CI dependency/secret gate，远端工作流与 Branch Protection 仍需要推送和 GitHub 配置证据。

## 已完成

- 建立统一 Chain Registry，当前写链为 Ethereum Sepolia。
- 普通 ETH/ERC-20 转账加入 UI 与 Handler 两层 Chain Guard。
- 批量转账的原子路径和顺序降级路径均加入 Chain Guard。
- 授权流程组合 SIWE Session、钱包账户、目标链和风险检测。
- 抽取 `useWriteChainGuard`，统一当前链判断、切链动作和切链状态。
- 授权风险确认与 Session、钱包账户和 `chainId` 绑定；上下文变化后旧意图不可见、不可确认，旧 AI 响应也不能重新激活它。
- 普通 ETH/ERC-20 转账使用统一五态交易模型，区分钱包确认、链上确认、成功与失败，并同时处理提交错误和回执错误。
- 批量转账的顺序降级路径逐笔等待链上回执；第二笔失败时展示 `partial-success`，防止把第一笔已确认的结果误报为整体失败或允许用户盲目重试。
- EIP-5792 原子批量路径将钱包请求、批次确认、成功和失败映射为产品状态；成功状态还会防御性检查回执，不直接展示钱包返回的原始状态字符串。
- 授权流程独立区分 AI 风险检测、钱包确认、链上确认、成功和失败；检测期间阻止重复请求，并为风险服务断连、钱包拒绝和回执失败提供反馈。
- 普通 ETH/ERC-20 转账识别 `repriced`、`cancelled` 和 `replaced`；取消或内容替换会覆盖回执 Hook 的成功状态，避免把替换交易误报为原操作成功。
- 授权交易同样识别加速、取消与内容替换；替换信息绑定当前钱包上下文，旧账户或旧网络的回调不能污染新授权状态。
- 建立版本化的待确认交易存储边界：仅保存公开哈希、账户、链、交易类型和时间，按钱包上下文隔离，严格校验并在 24 小时后过期。
- 普通 ETH/ERC-20 转账已接入待确认交易存储：提交后按账户、链和交易类型保存，刷新后恢复回执查询；确认、取消或内容替换后清理，加速时改存新哈希。
- 授权流程已接入待确认交易存储：只在钱包返回交易哈希后保存，刷新后恢复回执查询；风险告警、授权参数和继续授权意图仍只保留在内存中。
- 完成批量交易持久化边界设计：EIP-5792 原子批次 ID 与顺序降级交易哈希使用不同 payload，共享账户、链、TTL 和严格校验规则。
- 建立独立的版本化批量交易存储模块：原子与顺序记录按模式分键，顺序阶段使用判别联合约束，并覆盖上下文隔离、损坏数据和 24 小时过期处理。
- 原子批次已接入待确认批量存储：钱包返回 ID 后保存，刷新后只恢复状态查询；明确终态后清理，查询错误时保留记录并阻止重复发送。
- 顺序降级已接入阶段化存储与刷新恢复：分别恢复第一笔或第二笔回执；两次钱包请求之间刷新时只展示中断状态，绝不自动提交第二笔。
- 完成路线图复核：交易生命周期与刷新恢复主体已收口；Milestone 1 剩余风险集中在 API schema、AI 确定性降级和状态变更请求的 Origin 防护。
- `/api/risk-copilot` 已建立运行时输入 schema 与成本边界：只接受服务端支持的确定性 finding，限制 JSON 类型、16 KiB 请求体和 10 条 findings，非法输入不会调用 AI。
- 授权风险提示已支持 AI 确定性降级：Gemini 失败、空响应或客户端断网时仍展示规则证据与 spender，AI 只增强解释，不决定风险结论。
- 状态变更 API 已加入共享同源 Origin 防护：登录验证、登出、watchlist 写入和风险 AI 端点默认拒绝缺失或跨站来源，代理头仅在显式信任时使用。
- Milestone 1 收尾审计已补齐 SIWE `uri`/version/scheme 绑定、登录与 watchlist JSON 类型及字节边界，以及全站 CSP、frame、MIME、referrer 和 permissions 安全响应头；现有功能满足 Milestone 1 的代码退出条件。
- Milestone 2 / Batch C 已启动：原生 ETH 转账不再使用固定收款人和金额，新增确定性的地址与 18 位精度金额解析，在钱包请求前拒绝非法地址、零地址、非正数和不可精确表示的输入。
- ERC-20 转账已改为用户输入收款人和人类可读金额：从目标链合约读取 `decimals`/`symbol`，按真实精度转换为最小单位，拒绝超精度、零地址、非正数和 uint256 溢出，并将原始余额格式化为代币单位展示。
- 学习复盘已完成至 EIP-5792：已经复习钱包连接与 SIWE 身份、chain/network、交易 hash/receipt 生命周期、replacement/revert/partial success、待确认状态持久化和原子/顺序批量语义。
- ERC-20 转账已加入当前账户余额边界：余额未知或读取失败时 fail closed，解析后的最小单位金额超过余额时在钱包请求前阻止，成功 Receipt 后重新读取余额。
- 原生 ETH 转账已加入余额与 EIP-1559 Gas 预算：读取当前账户余额、估算目标请求的 Gas 单位和 `maxFeePerGas`，只有 `value + gas × maxFeePerGas <= balance` 时才允许请求钱包，确认后刷新余额。
- ETH 与 ERC-20 转账已加入钱包前 Review 快照：第一次操作只冻结并展示 chain、asset、recipient、显示金额、最小单位、余额以及适用的 Gas 预算，第二次确认才调用钱包；输入、账户、链、余额、模拟或 Gas 证据变化会使旧快照失效。
- ERC-20 转账已加入原生 Gas 余额边界：用同一 `transfer(recipient, amount)` 编码 calldata 估算合约调用 Gas，只有 Token 余额和 ETH Gas 预算同时充足才允许 Review，并在 Review 中冻结 Gas 预算与 ETH 支付余额。
- 普通 ERC-20 转账已接入按 `chainId + assetId` 查询的受支持资产 Registry 与资产选择器：地址、symbol 和 decimals 由应用 allowlist 决定，链上 `decimals()` 只用于一致性校验；未知 selector、未知链或 metadata 不一致均 fail closed，Review 与钱包请求会再次绑定 Registry 资产。
- 第一阶段学习复盘已完成，能够从身份、链、意图、执行、观察五个上下文解释架构，并区分单元、组件、Route 集成、生产构建证据及尚未覆盖的真实钱包/E2E/可观测性边界。
- ERC-20 与原生 ETH 已加入确定性的“最大金额”操作：Token 直接格式化整数最小单位余额；ETH 使用有效收款地址的独立 1 wei Gas 探测，从余额扣除 `gas × maxFeePerGas` 后填入候选值，再由最终 payload 重新估算并经过 Review 边界。
- 普通 ETH/ERC-20 转账已加入 Chain Registry 驱动的区块浏览器证据链接：pending 与成功指向当前交易 Hash，加速、取消或内容替换后指向 replacement Hash；未知 chainId 不猜测 Explorer URL，外部链接使用新标签页与 `noopener noreferrer`。
- 普通 ETH/ERC-20 转账已区分提交错误与 Receipt 观察错误：钱包未产生 Hash 前失败可重新 Review；已有 Hash 后查询失败显示“结果未知”、保留持久化记录并锁住发送，只允许对同一 Hash 调用 Receipt `refetch`。
- ETH/ERC-20 收款地址已加入安全剪贴板入口：剪贴板文本经过共享 checksum、格式与零地址校验后才写入表单；不可用、权限拒绝、非法或超长内容显式失败且不覆盖原值，异步读取的迟到结果不能覆盖较新的手动输入。
- 建立版本化且按 `chainId` 隔离的本地地址簿：严格校验 schema、checksum 地址、零地址、名称和 50 条容量边界；损坏、跨链或未知版本记录 fail closed。管理 UI 可将联系人明确填入 ETH 或 ERC-20 表单，但不会自动进入 Review 或请求钱包，未决交易期间选择入口保持锁定。
- ETH/ERC-20 收款输入已加入显式 ENS 解析：名称先经 viem ENS normalization 与 255-byte 边界校验，再固定查询写链；只有当前请求、当前输入和解析链仍一致时，返回地址才经 checksum/零地址校验后回填。未注册、RPC 失败或迟到结果均 fail closed，不会自动进入 Review 或钱包请求。
- 钱包连接层已接入可配置 WalletConnect 与明确的钱包选择：injected、EIP-6963 发现的钱包和 WalletConnect 作为独立 connector 展示；连接尝试、Wagmi 已连接、自动恢复、用户拒绝、connector 缺失、WalletConnect 未配置和切链失败使用不同状态，不再固定选择 `connectors[0]` 或由组件自行宣布“连接成功”。
- Milestone 2 最终代码审计已逐条覆盖路线图六项：validated forms、decimals、metadata/balance/max、address book/clipboard/ENS/checksum、Gas/Review/Explorer/retry/replacement 和 WalletConnect/selection 均有实现与自动化证据。真实移动钱包二维码配对与真实测试网交易哈希尚无仓库证据，继续作为手动发布验证边界明确保留，不虚构为已完成。
- Milestone 3 第一批已建立显式 Approval Registry 与 ERC-20 授权清单：读取当前连接账户在写链上的已登记 token/spender allowance，区分读取中、读取失败、零额度、有效额度和 uint256 最大值无限授权，并支持手动刷新。界面明确声明这是应用 Registry 的有限覆盖，不冒充完整钱包授权扫描。
- Milestone 3 第二批已完成 ERC-20 单项 revoke：从当前 allowance 冻结账户、链、token、spender 和原额度 Review，以完全相同的 `approve(spender, 0)` 请求先模拟再提交；Hash 返回后才保存，刷新后恢复指定 Registry target 的 Receipt，支持观察重试、replacement、Explorer 证据和成功后的 allowance 复核。
- Milestone 3 第三批已建立 Permit2 双层授权清单：同时读取 Token→Permit2 的 ERC-20 allowance 与 Permit2→Spender 的 amount/expiration/nonce，按目标链最新区块时间区分零额度、过期、底层额度为零但可能重新生效的 dormant、当前有效和读取失败，并验证 Sepolia canonical Permit2 runtime code hash。
- Milestone 3 第四批已完成 Permit2 单项 `lockdown`：从当前双层快照冻结账户、链、Permit2、token、spender、两层额度、expiration、nonce 和状态 Review，以完全相同的单项 tuple 请求先模拟再提交；Hash 返回后才保存，刷新后恢复 Receipt，支持观察重试、replacement、Explorer 证据和成功后的 Permit2 双层重新读取。
- Milestone 3 第五批已建立确定性 calldata 解码边界：用户显式输入目标合约与 calldata，当前只解释 Sepolia Registry 中 ERC-20 `approve(address,uint256)` 和 canonical Permit2 `lockdown((address,address)[])`，展示成功执行时的权限效果并复用无限授权确定性 finding；未知链、合约、selector、Permit2 tuple、损坏参数、超大 calldata 或超大批次均 fail closed，不交给 AI 猜测。
- Milestone 3 最终收尾批次已完成 EIP-2612 Permit 与 Permit2 PermitSingle 的严格 EIP-712 解析、domain/整数位宽/digest/账户/链/deadline 校验；calldata 解码器接入同一区块 `eth_call` 与权限前后证据；确定性规则扩展至产品阈值高额度、未知 spender、账户/链不一致和过期 deadline；授权风险用户的继续/取消决定以最小公开 finding code 记录持久化，不保存 AI 文案、原始 calldata/typed data 或签名。
- Milestone 4 第一批已建立 PostgreSQL migration、带 checksum/advisory lock 的迁移器、七类持久实体 Repository、Redis nonce/session revoke/rate-limit/idempotency 协调边界与本地 Compose 基础设施；数据库用复合外键约束 wallet/user/intent/chain 上下文，Redis key 不暴露原始用户标识。
- Milestone 4 第二批已把 SIWE nonce、Session 和 Watchlist 接入显式 `postgres` 模式：nonce 原子消费，Session 使用 256-bit opaque token 且数据库只存 hash，logout 同时建立 Redis 快速撤销与 PostgreSQL 持久撤销；Watchlist 按 user/chain 存储并在事务 advisory lock 内执行 20 条容量边界。生产未配置模式会拒绝启动相关路径，故障返回 503 而不静默降级。
- Milestone 4 第三批已建立四条支持链的 RPC Provider Registry：有效 Alchemy、显式独立 fallback 与 Viem chain public emergency provider 按顺序组成有界 fallback；每个 Provider 5 秒 timeout、零同源 retry、全列表只尝试一轮，确定性 revert 不 fallback。新增脱敏 `/api/health/rpc`、10 秒 single-flight cache，并让 CSP 从 Registry 生成无路径/无 key 的 provider origin。
- Milestone 4 第四批已建立结构化脱敏 Route 日志、服务端 request ID、OpenTelemetry trace/metric 接入和 Next server error hook；日志类型不接受任意 metadata，不记录异常 message/stack、请求体、Cookie、地址、Hash 或 RPC URL。新增 PostgreSQL/Redis/RPC 聚合就绪检查、版本化告警规则与故障 runbook；真实监控平台接收人和告警送达仍需部署环境证据。
- Milestone 4 第五批已升级存在公告的 Next.js、WalletConnect、Wagmi、Viem 与构建依赖，并用精确 transitive override 消除上游暂未提升的安全版本；当前完整 npm audit 为零。CI 使用 Node 24、不可变 Action SHA、锁文件安装、生产构建、PR Dependency Review 和完整历史 Gitleaks 扫描；Dependabot、安装脚本精确版本许可和供应链处置文档同步落库。
- Milestone 4 第六批已建立 Preview/Staging/Production 显式配置和 release preflight：部署环境绑定 HTTPS Origin、不可变 Git SHA、Next deployment ID、强认证密钥、持久化模式、WalletConnect/RPC 与可观测性出口；Staging/Production 缺任一受支持链独立 RPC fallback 会拒绝发布。Next.js 输出 standalone Node 24 容器，liveness 与 readiness 分离，结构化日志携带脱敏环境和 release 身份；发布顺序、expand/contract migration、前一镜像 digest 回滚和显式 legacy-cookie 紧急降级均已文档化。

## 当前未提交业务文件

Milestone 4 第一至五批业务代码与恢复文档均已提交，第六批已完成、待本批提交。`docs/PRODUCT_SPEC.md` 与
`docs/PRODUCTION_ROADMAP.md` 是此前已有的未跟踪产品文档，不属于本批，继续保持未提交。

## 最近完成的业务提交

- `495f6b5 feat: add production backend operations`
- `6c4fb1c docs: close milestone three code phase`
- `34186ed feat: complete wallet safety evidence`
- `dd9d64f docs: checkpoint Permit2 lockdown`
- `5d64ee9 feat: revoke Permit2 allowances`
- `9f8f874 docs: checkpoint Permit2 approval inventory`
- `34f4d65 feat: add Permit2 approval inventory`
- `70fe847 docs: checkpoint approval revoke`
- `f1f565d feat: revoke tracked ERC-20 approvals`
- `70e5c03 docs: checkpoint approval inventory`
- `21a4093 feat: add tracked approval inventory`
- `d553b73 fix: track sequential batch receipts`
- `0631125 feat: map atomic batch lifecycle states`
- `3b329a1 feat: track approval lifecycle states`
- `2c3376f fix: handle transaction replacements`
- `6f40a3a fix: handle approval replacements`
- `5c0c496 feat: add pending transaction storage`
- `33bb8da feat: restore pending transfers`
- `4dc57e2 feat: restore pending approvals`
- `ff09717 feat: add pending batch storage`
- `569afd8 feat: restore pending atomic batches`
- `8a885b6 feat: restore sequential batch progress`
- `477a119 fix: validate risk copilot input`
- `9ef7eca feat: preserve deterministic risk warnings`
- `4408e92 feat: enforce same-origin API mutations`
- `e7d8a2f fix: close milestone one security gaps`
- `171beb9 feat: validate native transfer input`
- `0ae417b feat: parse ERC-20 transfer amounts`
- `3db8b05 feat: enforce ERC-20 balance limits`
- `3688b65 feat: reserve native transfer gas`
- `f6b1b50 feat: review transfer payloads before signing`
- `55b2ed7 feat: reserve gas for ERC-20 transfers`
- `a56b8a5 feat: register supported transfer assets`
- `231533b docs: checkpoint supported asset registry`
- `5b6d396 feat: fill safe maximum transfer amounts`
- `dbda1d7 docs: checkpoint maximum transfer amounts`
- `15ab12e feat: link transfer explorer evidence`
- `1e1d2f7 docs: checkpoint transfer explorer evidence`
- `f31c92b fix: retry transfer receipt observation`
- `298367b docs: checkpoint safe receipt retries`
- `2d06878 feat: validate pasted transfer recipients`
- `51a2d77 docs: checkpoint safe transfer clipboard`
- `0177ee9 feat: add chain-scoped transfer address book`
- `3572b9c docs: checkpoint transfer address book`
- `675c690 feat: resolve transfer recipients with ENS`
- `f5ffa69 docs: checkpoint transfer ENS resolution`

## 当前步骤的设计结论

`useWriteChainGuard` 只统一行为，不统一业务文案。三个组件使用相同的目标链规则和切链动作，但分别解释转账、批量调用和授权为什么要求目标链，避免过早抽取万能 UI 组件。

Hook 测试锁定三项行为：目标链通过、其他链拒绝、切链动作始终指向统一配置的写链。

转账恢复状态同时绑定账户、链和交易类型。组件切换钱包上下文时只把匹配当前上下文的哈希交给回执 Hook，因此旧账户或旧网络的待确认交易不会污染当前 UI。浏览器存储恢复通过可取消的微任务完成，避免 React 19 的同步 effect 级联渲染，并防止快速切换上下文时旧恢复结果覆盖新状态。

授权恢复复用同一存储边界，但只有钱包提交成功回调能产生持久化记录。AI 风险检测完成和用户确认风险都不会落盘，因此刷新页面不会绕过风险检测恢复一个尚未签名的授权意图。确认、取消或内容替换会清理记录，加速则更新为替换哈希。

批量交易不能直接复用 `PendingTransactionRecord`：`wallet_sendCalls` 返回的 `id` 是供 `wallet_getCallsStatus` 使用的不透明字符串，不保证符合 32 字节交易哈希格式；顺序降级还必须记录当前阶段，才能在第二笔失败时保留“第一笔已确认”的事实。下一实现应建立独立、版本化的批量存储判别联合：原子记录保存 `id`；顺序记录保存 `stage`、`firstHash` 和按阶段可选的 `secondHash`。两者只保存公开标识符和执行进度，不保存 calldata、收款人或金额。

顺序恢复语义固定如下：第一笔待确认时恢复其回执查询；第一笔已确认但第二笔尚未提交时，刷新后只展示批次中断/部分完成并要求用户显式继续，绝不自动触发第二次钱包请求；第二笔已提交时恢复第二笔回执查询并保留第一笔已确认的事实。原子批次在成功或失败后清理，查询/网络错误时保留以便再次恢复；钱包确认阶段尚无 ID 或哈希，因此不持久化。

批量存储使用独立的 `web3-lab:pending-batch:v1` 命名空间，不迁移或破坏既有单笔交易 v1 数据。原子 ID 作为有长度上限且不含控制字符的不透明字符串校验；顺序记录只允许 `first-pending`、`first-confirmed`、`second-pending` 三个阶段，并且只有 `second-pending` 可以携带 `secondHash`。

原子批次恢复出的 ID 优先于当前能力检测结果：只要当前账户和链仍有未决原子批次，UI 就继续展示并查询它，不会切换到顺序降级入口。RPC/网络查询错误不是批次终态，因此记录保留且发送按钮继续锁定；只有状态明确为成功、失败或回执包含 `reverted` 时才清理。

顺序降级在第一笔哈希返回后保存 `first-pending`，第一笔确认后保存 `first-confirmed`，第二笔哈希返回后保存 `second-pending`。恢复 `first-confirmed` 时不发起任何钱包请求；回执查询错误保留记录并锁住整批重发。第二笔明确失败后虽然清理待确认记录，但 UI 仍保持 `partial-success` 锁定，防止用户立即重复第一笔。

路线图复核后，下一阶段继续完成 Milestone 1，而不是提前进入真实转账表单。`/api/risk-copilot` 当前只检查 `findings` 是否为数组，TypeScript 类型在运行时没有保护作用；绕过 UI 的请求可以伪造风险级别和代码、注入任意 detail，或提交过大数组消耗 AI 成本。服务端必须只接受确定性规则明确支持的 finding 结构，AI 只能解释通过校验的证据。

风险 finding 现在使用 `UNLIMITED_APPROVAL` 判别结构，服务端固定其 `high` 级别并严格校验唯一的 `spender` 地址字段，拒绝未知 code、级别降级和额外 prompt/detail。Route Handler 在读取流时累计字节并在 16 KiB 处停止，同时把最多 10 条 finding 作为第二层成本边界；认证检查仍先于请求体处理。

确定性 formatter 与 `assessRisk` 共享同一个判别 finding：服务端 AI 调用失败或无文本时返回 `degraded: true` 和规则文案，客户端连 Route 都无法访问时调用同一 formatter。只有这类解释服务降级会保留显式“继续授权”入口；明确的非 2xx API 拒绝仍阻止操作，即使错误响应体损坏也不会误走降级路径。

Origin 防护优先使用固定 `APP_ORIGIN`；未配置时比较请求 URL，只有 `TRUST_PROXY_HEADERS=true` 才读取 `X-Forwarded-Host/Proto`。这避免直接暴露的应用被伪造代理头绕过。保护范围是 `auth/verify`、`auth/logout`、watchlist `POST/DELETE` 和 `risk-copilot POST`；只读 session/watchlist GET 不校验，nonce GET 只轮换短期登录 nonce，后续验证仍受 nonce、domain 与 Origin 三层约束。

Milestone 1 的最终审计把“浏览器请求来源”和“钱包实际签署的登录声明”统一绑定到同一个可信应用 Origin。行业中的 SIWE relying party 不应只验证签名：还要校验 nonce、domain、URI、version、时间与支持链；本项目由 viem 验证签名/时间语义，应用层显式验证其余产品边界。`APP_ORIGIN` 是生产首选，可信代理配置只能显式开启。

轻量 JSON 写接口统一先检查 `application/json`，再按 UTF-8 字节读取并限流，最后才做字段 schema；这避免 TypeScript 类型被误当成运行时保护，也避免损坏 JSON 变成 500。登录上限 8 KiB，watchlist 上限 1 KiB；高成本 Risk Copilot 继续使用自己的 16 KiB 流式边界和 finding 数量限制。

安全响应头通过当前 Next.js 的 `headers()` 配置覆盖全站：CSP 限制脚本、样式、连接、frame、object 和表单来源，同时设置 `nosniff`、DENY frame、referrer 与敏感浏览器能力策略。当前静态 CSP 为兼容 Next.js hydration 保留 `unsafe-inline`；生产规模需要改成每请求 nonce 的动态 CSP，这是本实现有意保留的扩展点，而不是宣称已经达到最严格 CSP。

Milestone 1 退出证据：账户不一致时授权 UI 被阻断；写路径绑定 Sepolia；单笔、授权、原子批次和顺序降级均以回执终态为准并处理替换/取消/部分成功；待确认状态可按账户、链和交易类型恢复；API schema、AI 确定性降级、Origin 与安全头均有测试。最终验证为 21 个测试文件、134 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 生产构建通过。

Batch C 首个切片只替换原生 ETH 的固定输入，不同时改 ERC-20、余额、ENS、Gas 和 Review Screen。地址通过 viem 严格校验后规范化为 checksum address，并显式阻止零地址；金额只接受普通十进制定点格式，最多 18 位小数，再用 `parseEther` 转成整数 wei。表单永远不使用 JavaScript 浮点数，解析失败时也不会触发钱包请求。原有回执状态机、替换处理和待确认交易恢复保持不变。

ERC-20 金额不能假设 18 位精度：先使用受支持资产 Registry 中经过应用确认的 decimals，通过 `parseUnits` 将用户字符串转换为整数最小单位；0-decimal 代币不接受小数，结果还必须落在 uint256 范围内。Registry 接入前曾把受约束的链上 `symbol()` 仅用于展示；现在 symbol 完全来自 allowlist，链上 `decimals()` 只验证 Registry 是否仍与目标合约一致，不一致即禁止发送。模拟与钱包请求复用同一个已解析 payload，避免 UI 展示值和实际发送值分叉。

ERC-20 余额比较只在输入已解析为整数最小单位且当前账户、目标链、目标代币的 `balanceOf` 已返回时才允许通过；余额未知不是“暂时假定够用”，而是不可发送。余额检查改善错误反馈但不是并发保证：检查后余额仍可能被其他交易改变，因此合约模拟和最终 Receipt 继续作为后续防线。成功 Receipt 会触发余额重新读取，避免 UI 长期展示提交前缓存。

原生 ETH 余额不能只比较 `value <= balance`，因为同一余额还要支付 Gas。本轮使用当前请求的 `estimateGas` 与 EIP-1559 `maxFeePerGas` 计算保守预算上限，全部以 wei `bigint` 运算；余额、Gas 或 fee 任一未知/失败都禁止发送。该预算不是最终扣费保证：base fee、钱包参数和链上状态仍可能变化，最终费用由实际 `gasUsed × effectiveGasPrice` 决定，因此 UI 使用“预留最高 Gas 成本”措辞，Receipt 仍是最终证据。

Review Screen 不是把当前表单再显示一次，而是创建运行时冻结的判别快照；确认 handler 直接使用快照中的链上整数 payload，不重新解析可编辑输入。任何输入修改都会清除快照，账户/链上下文变化也会异步废弃；余额、token decimals、模拟结果或原生 Gas 预算变化时旧快照不再可确认。这样用户看到的 evidence 与交给钱包的 recipient/value/amount 保持同一版本，同时仍要求用户在钱包内做最终核对。

ERC-20 余额和 Gas 余额属于不同资产边界：`balanceOf` 足够只证明 Token 能转，账户还必须有原生 ETH 支付合约调用。Gas estimate 使用与模拟/钱包请求相同的 recipient 与最小单位 amount 编码 calldata，结合 EIP-1559 `maxFeePerGas` 得到预算；余额或预算变化会使 Review 失效。ERC-20 成功 Receipt 后同时刷新 Token 余额与 ETH 余额，因为前者发生资产转移，后者支付了 Gas。

资产选择器只保存公开的 `assetId`，不会把 option value 当作合约地址。所有链上读取、Gas 估算、模拟、Review 和最终钱包请求都通过写链 ID 与 selector 重新解析 Registry；对象原型属性也不能命中资产查找。Registry 是资产身份与展示 metadata 的权威来源，同时读取已登记合约的 `decimals()` 做运行时一致性校验，防止配置错误或合约变化把金额按错误精度发送。当前只登记 Sepolia USDC，不为制造多选效果而加入未经核实的测试币。

本切片最终验证为 27 个测试文件、166 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。生产构建首次仅因沙箱无法下载 Google Geist 字体失败，联网重跑后成功。

最大金额不是跳过校验的快捷发送。ERC-20 直接用 `formatUnits(balanceOf, Registry decimals)` 生成精确字符串，不进入 JavaScript 浮点数；余额为零、metadata 未验证或交易正在进行时按钮不可用。ETH 不能把完整余额作为 value：只有账户、目标链、余额、有效 checksum 收款地址、Gas estimate 与 EIP-1559 `maxFeePerGas` 都存在时，才计算 `balance - gasCostLimit`，且结果必须大于零。

ETH 最大值使用独立的 1 wei 请求探测收款路径 Gas，不复用用户可能已经填得过大的金额，因此最大按钮仍能纠正超余额输入。它只产生候选表单值；填入后实际金额会触发另一条 `estimateGas`，余额、fee 或 Gas 变化仍会让预算不足并阻止 Review。收款地址校验已抽成 ETH/ERC-20 共用纯函数，确保 Gas 探测与最终 parser 使用同一 checksum/零地址规则。

当前最大金额切片验证为 27 个测试文件、171 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。

Explorer URL 不是 UI 自己拼接的 Etherscan 常量：`getTransactionExplorerUrl(chainId, hash)` 只从当前 `ACTIVE_CHAINS` 配置中的 viem `blockExplorers.default.url` 生成，未知或未启用链返回 `undefined`。外部交易链接展示缩略 Hash，但 title 和无障碍名称保留完整 Hash；pending、success、receipt error 只要仍有受支持链上的公开 Hash 都可查看证据。

Replacement 证据必须跟随替换交易而不是原交易。普通转账的 replacement 状态现在额外保存产生回调时的账户/链/交易类型 context key，只有仍匹配当前上下文才参与状态机、文案和 Explorer 链接；这防止旧账户或旧链的延迟回调短暂生成错误链链接。`repriced`、`cancelled` 和 `replaced` 都优先展示 replacement Hash。

当前 Explorer 证据链接切片验证为 27 个测试文件、172 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。

Receipt/RPC 查询错误不是链上失败：只要当前账户、链和交易类型下仍有未决 Hash，普通转账就保持发送锁，即使 Wagmi 查询已经退出 `isLoading` 并返回 error。UI 不再把观察错误送入“转账失败，请重试”的提交错误文案，而是固定说明结果未知、禁止重发，同时继续提供 Explorer 证据和针对同一 Hash 的 `refetch`。查询错误不会清理本地 pending 记录。

钱包请求在 `onSuccess(hash)` 前被拒绝或提交失败时没有可恢复的链上标识，因此不建立未决 Hash 锁，用户可以修正输入并重新 Review。Handler 自身也检查未决 Hash，而不只依赖按钮 disabled；成功 Receipt、明确取消或不同内容 replacement 才会按照既有终态逻辑解除原操作锁，加速则继续跟踪新 Hash。

当前安全重试切片验证为 27 个测试文件、175 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。

剪贴板只是一个不可信输入源，不是地址校验的捷径。`readTransferRecipientFromClipboard` 接受最小 `readText()` 接口，捕获 API 缺失与权限拒绝，先限制原始文本长度，再复用 `parseTransferRecipient`；只有成功结果包含规范化 Address，失败结果不会携带或回显剪贴板原文。组件点击粘贴会先废弃旧 Review，但不会自动发起 Review 或钱包请求。

剪贴板读取是异步操作：每个 ETH/ERC-20 输入维护独立递增 request id，用户手动输入或组件卸载会使旧请求失效。只有返回时仍匹配最新 request id 的结果才能更新状态，因此权限弹窗或慢速剪贴板响应不能覆盖用户后来键入的地址。未决交易锁存在时粘贴按钮禁用，继续避免在结果未知期间制造新发送意图。

当前安全剪贴板切片验证为 28 个测试文件、182 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。

地址簿不是钱包身份系统，也不证明地址背后的人是谁；它只是用户在当前浏览器保存的公开标签与 checksum 地址映射。存储键和 payload 都包含 `chainId`，读取时还要求版本、字段集合、链 ID、规范化名称、checksum 地址、唯一地址及容量全部匹配。任何损坏、篡改、跨链内容或未知版本都返回空列表，不会把未经校验的地址送入转账表单。

地址是联系人唯一身份：再次保存同一地址会更新名称而不是创建重复项。名称只承担展示作用，trim 后限制为 1–40 个 Unicode 字符并拒绝控制字符；每条链最多 50 个联系人，浏览器读取、配额或权限异常都转换成显式 UI 错误。地址簿不保存金额、calldata、交易状态、私钥或签名。

联系人选择只执行一次受控表单填充，同时废弃旧 Review、旧剪贴板错误和仍在等待的剪贴板 request id；不会自动预览或发起钱包请求。ETH 与 ERC-20 使用独立按钮，任何一种转账存在未决 Hash 时两个选择入口均锁住，避免结果未知期间悄悄建立新的发送意图；保存和删除联系人仍是与链上交易无关的本地操作。

当前地址簿切片验证为 30 个测试文件、200 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。首次构建因受限环境无法下载 Google Geist 字体而失败，允许网络后同一代码构建成功；该失败与业务代码无关。

ENS 名称不是可直接转账的地址。用户必须显式点击解析，应用使用 viem 的 ENS normalization 规范化名称并限制规范化结果不超过 255 bytes；解析请求明确携带 `writeChain.id`，不会使用 Wagmi 默认的当前钱包链，也不会在 Sepolia 查不到时悄悄回落到 Ethereum Mainnet。查询返回值仍要经过共用的 checksum 与零地址 parser，只有通过后才替换表单文本。

ETH 与 ERC-20 各自维护独立的 ENS request id、原始输入快照和目标链。手动输入、粘贴、地址簿选择、组件卸载或新的解析请求都会让旧请求失效；异步结果只有在 request id、原始输入和 `chainId` 同时匹配时才能回填。因此慢 RPC 响应不能覆盖用户后来输入的地址，ENS 查询错误也只展示固定产品文案，不回显上游内部细节。

ENS 解析只建立“名称在指定链上当前解析为某地址”的查询证据，不证明该地址由联系人本人控制，也不冻结未来解析结果。解析成功只填入 checksum 地址并废弃旧 Review，后续仍必须经过余额、Gas、模拟、Review 快照和钱包确认；未决交易锁存在时解析按钮禁用，未注册名称、零地址与 RPC 错误均不可进入转账路径。

当前 ENS 切片验证为 31 个测试文件、210 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。

Wallet connector 是连接协议适配器，不是“钱包已经连接”的布尔开关。选择器把 injected/EIP-6963 与 WalletConnect connector 分开交给用户；`connectAsync` 只代表一次尝试，UI 只有在 `useConnection` 报告真实 `isConnected`、账户和 active connector 后才展示已连接。`reconnecting` 单独显示恢复状态并保持写入口不可用，避免刷新恢复期间短暂误报断开或可操作。

WalletConnect 使用 Wagmi 官方 connector 与 `@walletconnect/ethereum-provider` 运行时依赖。公开的 Reown project ID 通过 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 在构建时注入；空值或示例 placeholder 会让 connector 根本不注册，选择器明确显示“未配置”，不会等用户点击后才产生必然失败。项目 ID 是公开客户端标识，不是私钥，但仍属于按环境配置，不写死在源码。

连接错误经过确定性归约：用户拒绝、缺少 injected provider、WalletConnect pairing/session 失败和未知错误分别使用固定文案，未知上游内部细节不回显。切链仍是独立钱包请求，当前链按钮禁用，失败不会被当作连接失败或交易失败。断开连接只清理 connector connection；SIWE session 仍由既有钱包/session 一致性边界独立处理。

Milestone 2 最终自动化证据：33 个测试文件、225 项测试通过，TypeScript、ESLint、Diff 检查、离线 `npm ci --dry-run`、离线 production dependency audit（0 vulnerabilities）和启用 WalletConnect connector 分支的 Next.js 16.2.9 生产构建通过；本地生产服务返回 HTTP 200。Browser 技能确认当前会话没有可用浏览器实例，因此没有伪装可视化点击证据；仓库也没有真实 WalletConnect 二维码配对或普通转账测试网 Hash，这两项必须在获得真实 Reown project ID 与用户钱包授权后手动补证。

## Milestone 2 延后学习入口

当用户下次说“学习第二阶段”时，从本节开始，不重新开发代码，也不依赖旧聊天上下文。学习顺序：

1. 输入边界：手动地址、剪贴板、地址簿和 ENS 如何统一变成经过 checksum/零地址校验的收款地址。
2. 金额边界：人类十进制字符串如何按 ETH 或 Token decimals 转成 `bigint` 最小单位，为什么不能使用 JavaScript 浮点数。
3. 资产与余额边界：Chain-scoped Asset Registry、链上 metadata 一致性校验、余额判断和最大金额。
4. Gas 与模拟边界：ETH 和 ERC-20 为什么需要不同的资产预算，以及估算、模拟和最终 Receipt 分别证明什么。
5. Review 边界：为什么 Review 必须冻结一份意图与证据快照，输入或账户、链、余额变化后为什么必须失效。
6. 交易生命周期：钱包请求、Hash、Receipt、revert、replacement、观察错误、Explorer 证据和安全重试。
7. 恢复边界：刷新后只恢复公开交易标识和观察状态，为什么不能自动重发钱包请求。
8. 钱包连接边界：connector、connection、SIWE session、active account 和 active chain 为什么是不同状态。

代码入口：

- 输入：`lib/transferRecipient.ts`、`lib/transferEns.ts`、`lib/addressBookStorage.ts`
- 金额与资产：`lib/nativeTransferInput.ts`、`lib/erc20TransferInput.ts`、`lib/assetRegistry.ts`
- 余额、Gas 与 Review：`lib/nativeTransferBudget.ts`、`lib/transferReview.ts`
- 生命周期与恢复：`lib/transactionState.ts`、`lib/pendingTransactionStorage.ts`
- 完整业务编排：`components/token/TokenTransferPanel.tsx`
- 钱包层：`lib/wagmiConfig.ts`、`lib/walletConnection.ts`、`components/wallet/WalletConnectPanel.tsx`

第二阶段的核心心智模型固定为：不可信输入来源 → 规范化交易意图 → 指定链上的余额/模拟/Gas 证据 → 冻结 Review → 钱包请求 → 链上 Receipt 观察与刷新恢复。前一步的 UI 成功不替代后一步的链上证据。

Milestone 3 授权清单不能仅靠 ERC-20 `allowance(owner, spender)` 完整发现：该函数要求调用方事先知道 spender，没有“列出 owner 全部 spender”的链上枚举接口。因此第一批把发现来源明确建模为应用 Approval Registry，并复用 Asset Registry 中已确认的 token 身份和 decimals。未来扩大覆盖必须接入可信事件历史、索引器或后端并展示其区块范围，不能只添加“全量扫描”文案。

每个 Registry 目标绑定 `chainId + asset + spender + source`，合约读取固定使用写链和当前连接账户。`allowFailure: true` 保留每个 token/spender 的独立结果；顶层 RPC 错误、单项失败、缺失结果和非 `bigint` 数据统一归为“结果未知”，绝不误报为零授权。只有链上明确返回 0 才显示未授权，只有精确等于 `maxUint256` 才标记无限授权。

第一批只做读取基础，没有提前混入 revoke 写操作。ERC-721、ERC-1155、Permit 和 Permit2 仍要等各自真实 Registry/发现来源和协议语义落地后再加入，当前不制造假覆盖。

Milestone 3 第一批验证证据：新增 3 个测试文件、13 项测试；全仓 36 个测试文件、238 项测试通过，TypeScript、ESLint 和 Diff 检查通过。Next.js 16.2.9 生产构建第一次仅因受限网络无法下载项目既有 Google Geist 字体失败，联网重跑后成功。

单项 revoke 的 Review 不是一个普通确认弹窗：它冻结产生当前 allowance 的账户、链、Registry target、token、spender 和原始额度；钱包账户、active chain、Registry 身份或最新 allowance 任一变化都会使旧 Review 失效。模拟请求和最终 `writeContract` 请求是同一个 Wagmi request，避免“模拟 A、签署 B”。钱包不在写链时仍可读取清单，但写入口由 Chain Guard 阻断。

revoke 使用独立的 `web3-lab:pending-approval-revoke:v1` 存储，因为通用 approval Hash 无法说明正在撤销哪个 Registry target。记录每个账户和目标链至多一笔未决 revoke，只保存公开 target ID、Hash 和时间；严格校验账户、链、target ID、Hash 与 24 小时 TTL，恢复时还会再次确认 target 仍存在于当前 Registry。未知或已移除 target 不会被恢复。

Receipt 观察固定在目标链，不依赖钱包后来切到哪条 active chain。观察/RPC 错误保留 Hash 并锁住重复提交，只允许重查同一 Receipt；`repriced` 跟踪 replacement Hash，`cancelled` 或不同内容 replacement 清除原 revoke。Viem 查询成功不等于合约成功，因此还显式检查 Receipt `status`：`reverted` 不会刷新或宣称撤销成功。

即使 Receipt 为 `success`，产品也只说“撤销交易已确认”，随后重新读取真实 allowance。只有读数明确为 0 才显示权限已归零；仍非零时提示并发授权或非标准代币行为，读取失败时保持待核验。这避免把一次成功执行的合约调用直接等同于最终权限状态。

Milestone 3 第二批验证证据：新增 2 个纯模块测试文件并扩展组件生命周期测试，共新增 20 项测试；全仓 38 个测试文件、258 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。受限环境的首次构建仍只因既有 Google Geist 字体下载失败，联网重跑成功。

标准审计结论不能用一个 `allowance > 0` 模型覆盖所有权限：ERC-721 同时存在单 token `getApproved(tokenId)` 与 owner 全量 `isApprovedForAll(owner, operator)`，而 token ID 枚举不是基础 ERC-721 的必选能力；ERC-1155 标准权限是覆盖 owner 全部 token 类型的 operator bool；ERC-2612 Permit 是 EIP-712 签名，只有被提交后才更新普通 ERC-20 allowance，未提交签名不在链上形成可枚举清单。

Permit2 也必须拆成两类：`AllowanceTransfer` 在 canonical 合约中保存 owner/token/spender 的 uint160 amount、uint48 expiration 和 uint48 nonce，可以读取与 `lockdown`；`SignatureTransfer` 使用一次性签名和 unordered nonce，不建立同类持久 allowance，未泄露/未提交的链下签名无法通过本产品枚举。UI 已明确声明这个覆盖缺口。

Sepolia canonical Permit2 地址 `0x000000000022D473030F116dDEE9F6B43aC78BA3` 已通过项目 RPC 只读核验：runtime code 为 9,152 bytes，code hash 为 `0x96d9f5c3f0fb0423426b7f970186235b7347027f4e5c19c40c412b7d97fc3751`，`allowance(owner, token, spender)` 接口可调用。Registry 固定保存 chain、地址和该 runtime hash；浏览器读取时重新计算 Hash，不匹配、没有 bytecode 或缺少已完成的 RPC 数据都会 fail closed。

Permit2 的有效权限是双层交集：Token 必须先给 Permit2 ERC-20 allowance，Permit2 内部又必须给具体 spender 未过期额度。因此 active 状态的有效上限取两层 allowance 较小值；底层为 0 但内部额度未过期时不能标成“无授权”，而是 dormant，因为以后恢复底层 allowance 后内部授权会重新可用。Token 无限值是 uint256 最大值，Permit2 内部无限值是 uint160 最大值，不能混用。

expiration 使用目标链最新区块 `timestamp` 判断，而不是浏览器本地时间；Permit2 实现只在 `block.timestamp > expiration` 时视为过期，因此相等边界仍按有效处理。界面保留 nonce 与原始两层额度，并说明有效权限额度不等于钱包实际 Token 余额。

Milestone 3 第三批验证证据：新增 3 个测试文件、18 项测试；全仓 41 个测试文件、276 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。构建使用项目既有 Google Geist 字体，因此在允许网络下载后完成。

Permit2 `lockdown` 只操作 `AllowanceTransfer` 内部的 owner/token/spender 存储额度，不会撤销 Token→Permit2 的底层 ERC-20 allowance。因此 Review 和成功文案必须把两层效果分开，不能把内部 amount 归零表述成“Permit2 已获得的 Token 权限全部消失”。如果用户还要清除底层授权，那是另一笔对 Token 调用 `approve(Permit2, 0)` 的独立意图、模拟和交易。

可撤销范围不只包含当前 active 权限：expired 项仍保留非零历史 amount，dormant 项在底层 allowance 恢复后可能重新可执行，两者都允许显式 `lockdown`。只有内部 amount 明确为 0 的 none 状态不创建 Review；loading、读取错误或 runtime code 身份不匹配继续 fail closed。

Review 冻结当前账户、active chain、Registry target、Permit2 地址、token、spender、底层 ERC-20 allowance、Permit2 amount、expiration、nonce 和状态。任一证据变化都会使 Review 失效；模拟使用一个真实选中 target 组成长度为 1 的 `TokenSpenderPair[]`，最终提交直接使用模拟产生的 request。数组能力没有被伪装成尚不存在的多选产品。

Permit2 lockdown 使用独立 `web3-lab:pending-permit2-lockdown:v1` 命名空间，只保存公开的账户、链、Registry target ID、交易 Hash 与创建时间。记录按账户/链隔离、24 小时过期并在恢复时重新验证 target 仍存在；刷新只恢复同一 Hash 的 Receipt 观察，绝不自动重发 lockdown。

Receipt/RPC 错误继续保留 Hash 并锁住重复提交；加速更新 replacement Hash，取消或不同内容替换清除原操作。Receipt `success` 后同时重读合约 bytecode、区块时间和两层 allowance；只有 Permit2 内部 amount 明确为 0 才显示已归零，仍非零或读取失败都保持显式待核验。底层 Token→Permit2 allowance 无论是否仍非零，都不会被误报为本次 lockdown 的失败或成功目标。

Milestone 3 第四批自动化证据：新增 2 个纯模块测试文件并扩展 Permit2 组件生命周期测试，共新增 21 项测试；全仓 43 个测试文件、297 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。受限环境首次构建仍只因既有 Google Geist 字体无法联网下载而失败，允许网络后同一代码构建成功。

Calldata 解码必须同时绑定 chain、目标合约身份和 ABI，不能只拿前 4-byte selector 猜函数。selector 可能碰撞，同一字节在错误合约或错误链上没有可信语义；因此本批先验证输入、限制 16 KiB，再只从目标链 Registry 解析已登记 ERC-20 或 canonical Permit2。已知合约上的未知 selector 明确标为 unsupported，已支持 selector 的截断/损坏参数标为 invalid，两者不会混成“安全”。

ERC-20 `approve(spender, amount)` 的标准语义是覆盖当前 allowance，而不是在旧额度上增加 amount。解码器使用 Registry decimals 格式化整数额度：0 表示预期 revoke，精确 `maxUint256` 复用现有 `UNLIMITED_APPROVAL` 高风险 finding，其他值只描述为目标 allowance。Spender 只有命中 Approval Registry 时才显示登记标签，但合法地址本身仍可被确定性解码。

Permit2 `lockdown` 的 tuple 数组按 calldata 原顺序保留，只有每个 token/spender 都命中当前 Permit2 Approval Registry 才进入支持结果；任一未知 tuple 会让整个解释 fail closed。空数组作为合法 ABI no-op 展示，不伪造权限变化；最多解释 50 项，避免大输入制造不可审阅的 UI。成功效果只描述 Permit2 内部 amount 归零，并继续明确底层 Token→Permit2 ERC-20 allowance 不变。

ABI 解码不是 `eth_call` 模拟，也不含交易 envelope 中的 sender、chain、nonce、gas 和原生币 `value`。因此 UI 只使用“如果调用成功”的条件文案，并明确真实签名前仍需绑定完整请求与链上状态做模拟；解码成功不会产生“可执行”“安全”或“会成功”的结论。AI 既不参与函数识别，也不能扩大支持范围或改变确定性 finding。

Milestone 3 第五批验证证据：新增 1 个纯模块测试文件、1 个组件测试文件，共新增 13 项测试；全仓 45 个测试文件、310 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。

EIP-712 不是“把 JSON 展示一下”：解析器要求顶层字段、primary type、每个 struct 字段名称/类型/顺序、整数宽度和 address 全部匹配支持 schema，再绑定 Registry chain 与 verifyingContract。EIP-2612 domain 的 name/version 使用 Sepolia USDC 合约真实只读核验值 `USDC` / `2`，链上 `DOMAIN_SEPARATOR` 为 `0xb90e5057db141a932946e64d09ccb7ffc9b00bd79fec26f698d29af0c83320a6`；Permit2 domain 固定为官方实现的 name `Permit2`、chainId 与 canonical 合约地址。规范化后用 viem 计算 digest，未知 schema/domain 不由 AI 猜。

EIP-2612 Permit 把 owner、spender、value、nonce、deadline 一起签名，成功提交后覆盖普通 ERC-20 allowance；Permit2 PermitSingle 把 token、uint160 amount、uint48 expiration/nonce、spender、sigDeadline 绑定在签名中，只改变 Permit2 内部权限。typed-data UI 使用目标链区块 timestamp 检查 deadline，比较消息 owner 与当前账户、domain chain 与 active chain，并明确链下签名可能由第三方提交，解析页面本身不会请求签名。

Calldata 模拟证据固定到同一个目标链 block number：先以连接账户作为 `msg.sender` 执行完整 `eth_call`，再在相同区块读取 ERC-20 allowance 或 Permit2 allowance，展示当前值到 ABI 确定目标值的变化。`eth_call` 未 revert 只证明该区块/账户下调用路径可执行，不等于矿工最终打包，也不是通用 trace state-diff；approve/lockdown 按函数语义不转移 Token 或原生币，但真实交易仍消耗 Gas。

高额度不是普适真理，而是显式产品策略：Sepolia USDC Registry 当前阈值为 1,000 USDC（1,000,000,000 最小单位），命中时证据同时保存原始 amount 与 threshold；精确最大整数继续作为无限授权高风险。未登记 spender 只标为“无法提供可信标签”，不直接宣称恶意。账户不一致、active chain 不一致和 deadline 过期使用独立 finding，AI 只能解释这些已确定证据。

风险决定记录使用 `web3-lab:risk-decisions:v1`，按账户/链隔离，最多 50 条、90 天过期并严格校验。记录只包含操作类型、公开 target/spender、finding code、`proceeded-to-wallet` 或 `cancelled` 与时间；不保存 AI 输出、金额 payload、calldata、typed data、签名或私钥。这里记录的是用户决定进入或退出钱包请求，不伪装成交易成功证据。

Milestone 3 支持范围退出结论：ERC-20 与 Permit2 的库存、单项撤销、calldata、EIP-2612/Permit2 typed data、模拟/权限变化、确定性规则和风险决定恢复已经形成闭环。ERC-721/ERC-1155、真正多目标 batch revoke、合约源码验证/部署年龄/proxy implementation 变化仍缺真实 Registry 或外部证据源，明确不制造假数据；它们是覆盖扩展，不阻断“支持调用”的 Milestone 3 退出条件，并将在 Milestone 4 的索引/RPC/运营数据层具备后扩展。

Milestone 3 最终自动化证据：全仓 48 个测试文件、328 项测试通过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。生产构建第一次因既有 Google Geist 字体网络请求失败，同一代码联网重试成功；没有伪造真实钱包签名、真实 Permit 提交或通用 trace 模拟证据。

Milestone 4 的第一批先建立数据边界而不直接改 Route：PostgreSQL 是用户、wallet ownership、session、watchlist、交易意图/Receipt 和风险报告的可靠事实源；Redis 只保存带 TTL 的 nonce、撤销快速路径、限流计数与在途幂等 claim。Redis 丢失不能抹除交易或身份事实，PostgreSQL 暂时不可用也不能降级成“默认允许”。

Session 表只保存 64 位 SHA-256 token hash；风险报告只接受 finding code、严重级别和用户决定。Schema 用复合外键保证 session/intent/risk report 中的 wallet 确实属于同一个 user，Receipt 的 chain/hash 确实对应同一 intent；用户级 idempotency key 与 request fingerprint 同时防止“同 key 不同请求”被误当成安全重放。

Repository 使用 `pg` 参数化查询与有界连接池，创建钱包身份使用 transaction-scoped advisory lock，Receipt 与 intent 终态在同一数据库事务更新。迁移器对每个历史 SQL 保存 checksum，并用全局 advisory lock 防止并发部署重复执行；历史迁移被修改时 fail closed。

Redis Coordinator 的所有外部标识先哈希再进入 key；SIWE nonce 通过 `GETDEL` 只能消费一次，限流通过单个 Lua 脚本完成 `INCR` 与首次 `EXPIRE`，幂等 claim 明确区分首次取得、相同请求重放和同 key 冲突。Redis session revoke 是加速检查，不取代 PostgreSQL 的持久撤销时间。

Milestone 4 第一批自动化证据：新增 6 个测试文件，其中 21 项本地定向测试通过、2 项真实服务集成测试因本机无运行时按显式环境开关跳过；全仓 54 个测试文件、349 项通过、2 项跳过，TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。构建第一次只因受限网络无法下载项目既有 Google Geist 字体失败，同一代码联网重跑成功。CI 已配置 disposable PostgreSQL/Redis、真实 migration 和集成测试，但在 workflow 实际通过前不伪造该证据。联网 production dependency audit 当前报告 10 项既有依赖公告（1 moderate、9 high），漏洞链未指向本批新增的 `pg`/`redis`；不使用 `npm audit fix --force` 跨版本破坏 Next.js，保留给 Milestone 4 CI/依赖治理批次逐项升级验证。

Milestone 4 第二批使用显式 cutover，而不是数据库失败后自动退回 Cookie：生产必须设置 `BACKEND_STORAGE_MODE=postgres`，`legacy-cookie` 只用于人工紧急回滚。两种模式的 Session cookie 格式不同，切换后用户可能需要重新登录；数据库中的 Watchlist 不会丢失，但 legacy 路径在恢复 postgres 模式前无法展示它。这个取舍避免后端故障时悄悄绕过撤销、nonce 和服务端事实边界。

后端登录生命周期固定为：Redis 签发一次性 nonce → SIWE 确定性验证 → 验证成功后 `GETDEL` 原子消费 → 创建/复用 wallet identity → 生成 32-byte 随机 bearer token → PostgreSQL 只保存 SHA-256 hash 与 user/wallet/chain/expiry → Cookie 只保存原 token。并发重放即使都通过签名校验，也只有一个请求能消费 nonce 并创建 Session。

Session 查询先验证 opaque token 格式和 Redis 撤销标记，再读取 PostgreSQL 中未撤销、未过期且 user active 的记录；API 只返回 address/chainId，不向浏览器暴露内部 UUID。Logout 先写 Redis 撤销快速路径，再写数据库持久撤销，完成后才删除 Cookie；持久撤销失败返回 503 并保留 Cookie，避免 UI 宣称已经安全登出。

Watchlist 在 postgres 模式按 `userId + session.chainId` 隔离。添加操作使用 transaction-scoped advisory lock 串行化同一用户/链的 duplicate、count 和 insert，避免两个并发请求都在 19 条时各自通过检查导致越界。数据库/Redis 故障明确返回 503；前端 Session、Watchlist、SIWE nonce 和 Logout hooks 已检查非 2xx，不会把 `{ error }` 响应误当成功数据。

Milestone 4 第二批自动化证据：全仓 58 个测试文件、374 项通过，另有 1 个文件中的 2 项真实服务集成测试按本机缺少 runtime 显式跳过；TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。构建第一次仍只因受限网络无法下载既有 Google Geist 字体失败，同一代码联网重跑成功。新增测试覆盖存储模式、nonce collision/单次消费、Session token hash/expiry/revoke、认证 Route 重放/公开响应/logout 失败、PostgreSQL Watchlist scope/capacity/503 和前端错误边界。

Milestone 4 第三批不把 fallback 等同于无限重试：单个 Provider 不原地 retry，网络/限流失败才按固定列表尝试下一 Provider，所有 Provider 耗尽后立即返回失败；合约 execution revert 属于确定性业务结果，必须直接返回，不能换节点试图“洗掉”revert。Receipt polling 只观察已有 Hash，钱包签名与提交仍由 connector 发起，不进入公共 RPC 自动重发路径。

缺失或占位 Alchemy key 不再生成包含 `undefined` 的 URL。生产可为四条链分别配置独立 fallback；未配置时 Viem chain public RPC 只是应急可用性，不被宣称为商业容量。由于这些读取同时运行在浏览器，CSP `connect-src` 从同一 Registry 提取 provider origin，去掉路径和 API key，避免“transport 会 fallback、浏览器 CSP 却拦截”的假容灾。

`/api/health/rpc` 并行执行 `eth_blockNumber` 探针，严格验证 HTTP、4 KiB 响应上限、JSON-RPC envelope 与 hex block number；只返回 provider ID/name、latency、status 与十进制 block number，不返回 URL、上游错误或凭据。写链全部 Provider 不可用时 HTTP 503；部分 Provider 失效但仍可服务时返回 200 + `degraded`。10 秒进程缓存和 single-flight 防止监控请求自身放大 RPC 流量。

Milestone 4 第三批自动化证据：全仓 61 个测试文件、392 项通过，另有 1 个文件中的 2 项真实 PostgreSQL/Redis 服务集成测试按本机缺少 runtime 显式跳过；TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过，构建首次仍仅因受限网络无法下载既有 Google Geist 字体失败，同一代码联网重跑成功。新增 18 项测试覆盖 Provider 顺序与配置校验、CSP 脱敏 origin、primary→fallback、预算耗尽、revert 不 fallback、探针响应/超时/脱敏、critical chain 状态和 health Route HTTP 映射；尚未声称真实生产 Provider 容量、SLO 或告警送达证据。

Milestone 4 第四批采用“固定字段而非事后正则脱敏”：Route logger 只接受 event、固定 route/method、status、duration、request/trace ID 与有限 dependency/error type，不提供任意 metadata 容器，因此调用方不能顺手把 header、Cookie、请求体、钱包地址、Hash、calldata、异常 message/stack 或上游响应塞进运营日志。每个 Route 响应带服务端生成的 `X-Request-Id` 和 `Server-Timing`；相同低基数字段同时写入 OpenTelemetry span/counter/histogram。

Next.js 16 根级 `instrumentation.ts` 使用官方 `@vercel/otel` 注册 framework traces，并用 `onRequestError` 记录未捕获 server error 的安全类型与 digest。通用 outbound fetch instrumentation 被显式关闭：当前 RPC API key 可能位于 URL path，自动采集完整 URL 会把公开客户端标识进一步扩散到监控系统；RPC/Gemini 降级改由明确的安全事件记录。配置 OTLP base/metrics endpoint 时才安装真正的 HTTP MetricReader 并导出 request counter/duration histogram；未配置时告警从 JSON 完成日志派生，不把 no-op Metrics API 冒充成数据源。OTLP endpoint/header 只能使用服务端环境变量，不能加 `NEXT_PUBLIC_`。

`/api/health/ready` 在 postgres 模式并行检查数据库、Redis 与关键 RPC，在显式 `legacy-cookie` 回滚模式把前两者标成 `not_required`；配置错误或任一必要依赖失效返回 503，响应不含连接串、URL 或异常正文。`ops/alerts/rules.json` 固化 availability、telemetry absence、RPC degraded/unhealthy、5xx rate、p95 latency 和 AI explanation degrade 的窗口/最少样本/severity/runbook。规则进入仓库不等于外部接收人已收到告警，部署前仍必须配置监控平台并保存一次真实送达测试证据。

Milestone 4 第四批自动化证据：全仓 66 个测试文件、406 项通过，另有 1 个文件中的 2 项真实 PostgreSQL/Redis 集成测试按本机缺少 runtime 显式跳过；TypeScript、ESLint、Diff 检查和 Next.js 16.2.9 生产构建通过。构建首次仅因受限网络无法下载既有 Google Geist 字体失败，同一代码联网重跑成功。生产依赖 audit 当前明确报告 11 个受影响依赖节点（1 moderate、10 high），其中直接依赖 Next.js 与 Viem 均已有升级方向；新增 OpenTelemetry 顶层包未出现在该报告中。漏洞尚未治理，下一批必须逐项升级/验证并建立 CI gate，不能把本批构建通过误写成依赖安全通过。

Milestone 4 第五批没有用 `npm audit fix --force` 或降低阈值掩盖告警。Next.js 与配套 ESLint config 固定到已包含安全修复的 16.3.4；WalletConnect/Wagmi/Viem 和 Tailwind 构建链同步升级。Reown/Coinbase 的暂时性传递依赖缺口通过精确 `@base-org/account@2.5.10`、`@coinbase/cdp-sdk@1.52.0` 与 `axios@1.20.0` override 收口：CDP 1.53+ 当前会让未使用 x402 的应用 bundle 仍解析其 optional peer imports，故先固定到可构建边界。后续升级必须优先重测并移除 override。五个安装脚本逐项读取后按包和版本许可，新版本默认不得继承授权。

CI 与 Security 分离：CI 证明锁文件安装、migration、lint、类型、测试和 production build；Security 证明 npm 已知公告阈值、PR 新增依赖风险和 Git 历史 secret pattern。所有第三方 Action 使用完整 commit SHA，pull request 检查不使用 `pull_request_target`，避免执行 fork 代码时扩大 secrets 权限。工作流文件落库不等于远端已经通过，也不等于 Branch Protection 已经要求这些检查。

Milestone 4 第五批最终自动化证据：全仓 67 个测试文件、409 项通过；另有 1 个文件中的 2 项真实 PostgreSQL/Redis 集成测试按本机缺少 runtime 显式跳过。TypeScript、ESLint、YAML 解析、Diff 检查和两档联网 npm audit 通过，生产与完整依赖均为 0 个已知公告。Next.js 16.3.4 的 Webpack production build 完成全部编译、类型、页面生成和 trace；当前受控执行环境禁止 Turbopack 的 PostCSS 子进程绑定本地端口，因此默认 Turbopack build 仍须由 GitHub Runner 证明。构建保留 Viem/Wagmi 未启用可选 connector 的静态解析 warning，没有为消除 warning 安装未使用 SDK。

Milestone 4 第六批不把 `NODE_ENV=production` 当成环境隔离：Preview、Staging、Production 都运行优化构建，因此新增 `DEPLOYMENT_ENVIRONMENT` 表达运营环境，并以 `RELEASE_ID`、`NEXT_DEPLOYMENT_ID` 和精确 `APP_ORIGIN` 绑定一次不可变发布。发布预检只输出非敏感证据；正常发布必须使用 PostgreSQL 模式、强随机认证密钥、真实 WalletConnect/Alchemy 标识和明确监控出口，Staging/Production 还必须为四条支持链各配置独立 fallback。`legacy-cookie` 只有带显式 CLI 例外的事故回滚才能通过。

Next.js 16.3.4 按仓库内官方文档启用 `output: standalone` 与 deployment ID version-skew 防护。容器分 build/runtime stage、使用 Node 24、非 root 用户，只把 `NEXT_PUBLIC_*` 作为构建参数；数据库、Redis、认证和遥测凭据只允许运行时注入。迁移文件和 runner 被包含在镜像中但不会在每个应用副本启动时自动执行，发布系统必须以单独受保护任务执行一次并依靠 checksum/advisory lock。`/api/health/live` 只证明进程能回答 HTTP；`/api/health/ready` 同时验证 deployment identity 与必要依赖，外部依赖故障应摘除流量而不是制造重启风暴。

第六批最终本地证据：全仓 69 个测试文件、425 项通过，另有 1 个文件中的 2 项真实 PostgreSQL/Redis 集成测试显式跳过；TypeScript、ESLint、YAML 解析、Diff 检查、release preflight 和 Next.js 16.3.4 Webpack production standalone build 通过。standalone `server.js` 已实际启动：liveness 返回 200，readiness 返回 staging/release 身份并在公共 RPC 部分超时时诚实报告 degraded；日志同时携带安全环境/release 字段。机器没有 Docker/Podman，故未声称真实镜像 build；云端环境、GitHub Environment 审批、真实数据库 migration、告警送达、DNS/TLS 和不可变镜像回滚仍需外部部署证据。

## 下一步

Milestone 4 第一至五批已提交，第六批环境/回滚代码已完成验证并进入提交。下一代码批次是 Milestone 4 最后一项：备份、恢复演练、保留/删除规则、隐私/条款/风险披露和支持流程。GitHub workflow、Gitleaks、受保护环境和真实服务集成仍须推送后由远端系统产生证据，不在本地伪造。Milestone 2/3/4 的集中学习继续保留到用户要求时再进行。

## 工作约束

- 每轮只处理一个明确的小步骤。
- 修改后运行相关测试、TypeScript、ESLint 和 Diff 检查。
- 默认先让用户 Review；用户明确要求提交的批次在完整验证通过后提交，不自动推送。
- 每轮结束更新本文件。
