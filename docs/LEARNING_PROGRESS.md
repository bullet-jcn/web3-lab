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

## 当前未提交业务文件

无。`docs/PRODUCT_SPEC.md` 与 `docs/PRODUCTION_ROADMAP.md` 是此前已有的未跟踪产品文档，不属于当前业务步骤。

## 最近完成的业务提交

- `d553b73 fix: track sequential batch receipts`
- `0631125 feat: map atomic batch lifecycle states`
- `3b329a1 feat: track approval lifecycle states`
- `2c3376f fix: handle transaction replacements`
- `6f40a3a fix: handle approval replacements`
- `5c0c496 feat: add pending transaction storage`
- `33bb8da feat: restore pending transfers`

## 当前步骤的设计结论

`useWriteChainGuard` 只统一行为，不统一业务文案。三个组件使用相同的目标链规则和切链动作，但分别解释转账、批量调用和授权为什么要求目标链，避免过早抽取万能 UI 组件。

Hook 测试锁定三项行为：目标链通过、其他链拒绝、切链动作始终指向统一配置的写链。

转账恢复状态同时绑定账户、链和交易类型。组件切换钱包上下文时只把匹配当前上下文的哈希交给回执 Hook，因此旧账户或旧网络的待确认交易不会污染当前 UI。浏览器存储恢复通过可取消的微任务完成，避免 React 19 的同步 effect 级联渲染，并防止快速切换上下文时旧恢复结果覆盖新状态。

## 下一步

将待确认交易存储接入授权流程，刷新后按当前账户和链恢复授权回执查询，同时保持风险确认意图不落盘。

## 工作约束

- 每轮只处理一个明确的小步骤。
- 修改后运行相关测试、TypeScript、ESLint 和 Diff 检查。
- 不自动 Commit；先让用户 Review 和理解。
- 每轮结束更新本文件。
