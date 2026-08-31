# Web3 Lab 学习进度

这份文件是跨对话恢复点。每完成一个学习步骤后更新，避免聊天连接或上下文压缩失败造成进度丢失。

## 当前目标

Milestone 2 / Batch C 的代码实现与自动化退出审计已经完成。下一阶段先进行 Milestone 2 整体学习复盘，把真实转账表单、金额与余额、Gas、Review、恢复状态、地址输入来源、ENS 和钱包连接层串成一套可解释架构，再决定是否进入 Milestone 3。

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

## 当前未提交业务文件

当前 Milestone 2 钱包连接收尾代码待按用户授权提交：

- `.env.example`
- `README.md`
- `components/wallet/WalletConnectPanel.tsx`
- `components/wallet/WalletConnectPanel.test.tsx`
- `lib/wagmiConfig.ts`
- `lib/walletConnection.ts`
- `lib/walletConnection.test.ts`
- `package.json`
- `package-lock.json`
- `docs/LEARNING_PROGRESS.md`

`docs/PRODUCT_SPEC.md` 与 `docs/PRODUCTION_ROADMAP.md` 是此前已有的未跟踪产品文档，不属于当前业务步骤。

## 最近完成的业务提交

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

## 下一步

按用户本轮授权分别提交钱包连接业务代码与 Milestone 2 恢复文档。提交后明确通知 Milestone 2 代码阶段结束，并开始整体学习复盘；不直接进入 Milestone 3。GitHub 当前 DNS 解析失败只影响 push，不影响本地 commit，恢复网络后再推送。

## 工作约束

- 每轮只处理一个明确的小步骤。
- 修改后运行相关测试、TypeScript、ESLint 和 Diff 检查。
- 不自动 Commit；先让用户 Review 和理解。
- 每轮结束更新本文件。
