# Web3 Lab 学习进度

这份文件是跨对话恢复点。每完成一个学习步骤后更新，避免聊天连接或上下文压缩失败造成进度丢失。

## 当前目标

建立安全、可解释的 Web3 写操作流程，并在每一步保留可 Review 的未提交 Diff。

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

## 当前未提交业务文件

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

## 下一步

为 `/api/risk-copilot` 建立显式运行时 schema 和大小边界，并补充 validator 与 Route Handler 测试；只处理输入可信边界，不在同一 Batch 改 AI 降级 UI 或 Origin 防护。

## 工作约束

- 每轮只处理一个明确的小步骤。
- 修改后运行相关测试、TypeScript、ESLint 和 Diff 检查。
- 不自动 Commit；先让用户 Review 和理解。
- 每轮结束更新本文件。
