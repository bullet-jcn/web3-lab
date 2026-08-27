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

## 当前未提交业务文件

- `components/token/TokenTransferPanel.tsx`
- `components/token/BatchedTransferDemo.tsx`
- `components/token/ApprovalRiskDemo.tsx`
- `lib/hooks/useWalletSession.ts`
- `lib/hooks/useWriteChainGuard.ts`
- `lib/hooks/useWriteChainGuard.test.tsx`

## 当前步骤的设计结论

`useWriteChainGuard` 只统一行为，不统一业务文案。三个组件使用相同的目标链规则和切链动作，但分别解释转账、批量调用和授权为什么要求目标链，避免过早抽取万能 UI 组件。

Hook 测试锁定三项行为：目标链通过、其他链拒绝、切链动作始终指向统一配置的写链。

## 下一步

Review 并提交完整的 Chain Guard 与授权意图失效功能，然后继续补写操作错误反馈与交易状态的一致性。

## 工作约束

- 每轮只处理一个明确的小步骤。
- 修改后运行相关测试、TypeScript、ESLint 和 Diff 检查。
- 不自动 Commit；先让用户 Review 和理解。
- 每轮结束更新本文件。
