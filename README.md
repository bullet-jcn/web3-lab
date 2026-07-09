# web3-lab

基于 Next.js + viem + wagmi 构建的以太坊 DApp 前端，实现了钱包连接、链上资产查询与合约交互的完整闭环，并在实现过程中落地了若干 Web3 前端的安全实践。

## 功能

- 钱包连接 / 断开（injected connector，兼容 MetaMask 等浏览器扩展钱包）
- ETH 原生余额查询
- ERC20 代币余额查询
- ERC20 转账，转账前通过 `simulateContract` 预检查，避免必然失败的交易被广播上链、白白消耗 gas
- 原生 ETH 转账
- 多链切换（Sepolia 测试网 / 以太坊主网）
- 交易状态全链路反馈：签名中 → 上链确认中 → 成功 / 失败
- 错误信息人性化处理：将钱包拒签、gas 不足、合约 revert 等原始错误归类为可读的中文提示

## 安全实践

- **环境变量分级**：区分会被打进浏览器 bundle 的 `NEXT_PUBLIC_` 变量与仅服务端可见的敏感配置，避免高权限 key 暴露给客户端
- **最小必要授权**：ERC20 `approve` 额度按实际需要值申请，不采用无限额度（`maxUint256`）授权，降低下游合约被攻破时的资产暴露面
- **敏感信息隔离**：私钥 / 助记词不进代码、不进日志、不进版本控制

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 框架 | Next.js (App Router) + React |
| 链交互 | [viem](https://viem.sh) |
| React Hooks 封装 | [wagmi](https://wagmi.sh) |
| 数据状态管理 | TanStack Query |
| 语言 | TypeScript |

## 目录结构

```
app/
  layout.tsx        # 根布局，接入 Providers
  page.tsx           # 主页面：钱包连接、余额查询、转账、切链
  providers.tsx       # WagmiProvider + QueryClientProvider
lib/
  wagmiConfig.ts     # wagmi 链与 connector 配置
  viemClient.ts       # 公共 viem client
  readBalance.ts      # 余额查询封装
```

## 本地运行

1. 在项目根目录创建 `.env.local`（已被 `.gitignore` 忽略，不会被提交）：
   ```
   NEXT_PUBLIC_ALCHEMY_URL=你的 Alchemy Sepolia RPC URL
   ```
2. 安装依赖并启动：
   ```bash
   npm install
   npm run dev
   ```
3. 打开 [http://localhost:3000](http://localhost:3000)，需要浏览器安装 MetaMask 并切换到 Sepolia 测试网

## Roadmap

- [x] 链上数据读取（区块高度、余额）
- [x] 钱包连接与状态管理
- [x] ERC20 / 原生 ETH 转账与交易状态跟踪
- [x] 多链切换
- [ ] 接入 WalletConnect，支持移动端钱包
- [ ] 交易历史记录展示
