# Web3 Lab 学习进度

这份文件是跨对话恢复点。每完成一个学习步骤后更新，避免聊天连接或上下文压缩失败造成进度丢失。

## 当前目标

推进 Milestone 2 / Batch C 的真实转账工作流，并在每一步保留可 Review 的未提交 Diff。完整学习复盘已再次暂停：钱包身份、链边界、交易生命周期、replacement/partial success、持久化边界和 EIP-5792 已复习，后续从“授权风险与 AI 边界”继续。

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

## 当前未提交业务文件

无。ERC-20 余额边界已提交，当前仅更新本恢复文件。

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

ERC-20 金额不能假设 18 位精度：本轮先读取当前写链上固定代币合约的 `decimals()`，再用 `parseUnits` 将用户字符串转换为整数最小单位；0-decimal 代币不接受小数，结果还必须落在 uint256 范围内。`symbol()` 属于合约提供的不可信展示 metadata，因此只接受 1–12 个可打印 ASCII 字符，异常时退回 `ERC-20`，绝不让 symbol 决定合约地址、精度或交易参数。模拟与钱包请求复用同一个已解析 payload，避免 UI 展示值和实际发送值分叉。

ERC-20 余额比较只在输入已解析为整数最小单位且当前账户、目标链、目标代币的 `balanceOf` 已返回时才允许通过；余额未知不是“暂时假定够用”，而是不可发送。余额检查改善错误反馈但不是并发保证：检查后余额仍可能被其他交易改变，因此合约模拟和最终 Receipt 继续作为后续防线。成功 Receipt 会触发余额重新读取，避免 UI 长期展示提交前缓存。

## 下一步

读取原生 ETH 余额并设计“转账 value + Gas 成本”的可发送边界，不能简单用 `value <= balance`；学习复盘待恢复时从“授权风险与 AI 边界”继续。

## 工作约束

- 每轮只处理一个明确的小步骤。
- 修改后运行相关测试、TypeScript、ESLint 和 Diff 检查。
- 不自动 Commit；先让用户 Review 和理解。
- 每轮结束更新本文件。
