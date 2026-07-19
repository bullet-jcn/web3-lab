# web3-lab

A Next.js + wagmi/viem dApp that goes past "connect wallet, show balance": Sign-In with Ethereum, a stateless signed-cookie session, a session-gated watchlist, and an EIP-5792 atomic batch-transfer demo with an honest non-atomic fallback.

基于 Next.js + wagmi/viem 构建，不止于"连钱包、查余额"——包含 SIWE 登录、无数据库的自包含签名 cookie 会话、需要登录才能用的关注列表，以及 EIP-5792 原子批量转账（带诚实的非原子降级方案）。

## Features 功能

- **Wallet connect / multi-chain balances** — injected connector (MetaMask-compatible), Sepolia + Ethereum mainnet, chain switching, per-chain balance via `useQueries`.
  钱包连接、多链余额（Sepolia + 以太坊主网），支持切链，用 `useQueries` 并行查询每条链。
- **Sign-In with Ethereum (EIP-4361)** — nonce issuance → wallet signature → server-side verification via `viem/siwe`, backed by a stateless HMAC-signed session cookie (no database).
  SIWE 登录——签发 nonce → 钱包签名 → 服务端用 `viem/siwe` 验证，会话是无数据库的 HMAC 签名 cookie。
- **Session-gated watchlist** — add/remove watched addresses, persisted the same way as the session (signed cookie, scoped per address).
  登录后才能用的关注列表——增删关注地址，用同一套签名 cookie 机制持久化（按地址隔离）。
- **EIP-5792 atomic batch transfer** — detects wallet capability via `useCapabilities`, submits two ERC20 transfers as one atomic `useSendCalls` batch when supported, and explicitly falls back to two sequential (non-atomic) transactions — with the UI stating plainly that a mid-sequence failure won't roll back the first transfer.
  EIP-5792 原子批量转账——用 `useCapabilities` 检测钱包能力，支持则把两笔 ERC20 转账合并成一次原子 `useSendCalls`；不支持则显式降级为两笔顺序交易，并在 UI 上明确说明"第二笔失败不会撤销第一笔"。
- **ERC20 / native ETH transfer** — pre-flight `simulateContract` check before broadcasting, on-chain confirmation tracking, and human-readable error messages instead of raw RPC errors.
  ERC20 / 原生 ETH 转账——广播前用 `simulateContract` 预检查，追踪链上确认状态，把原始 RPC 错误转成可读的中文提示。

## Tech stack 技术栈

| Category 分类 | Tech 技术 |
| --- | --- |
| Framework 框架 | Next.js 16 (App Router) + React 19 |
| Chain interaction 链交互 | [viem](https://viem.sh) |
| React hooks 封装 | [wagmi](https://wagmi.sh) |
| Server state 服务端状态 | TanStack Query |
| Styling 样式 | Tailwind CSS v4 |
| Testing 测试 | Vitest + Testing Library |
| Language 语言 | TypeScript |

## Directory structure 目录结构

```
app/
  api/
    auth/{nonce,verify,session,logout}/route.ts   # SIWE 登录相关 Route Handlers
    watchlist/route.ts                            # 关注列表 CRUD Route Handler
  layout.tsx / page.tsx / providers.tsx

components/
  auth/SignInWithEthereum.tsx        # 登录/登出 UI
  watchlist/WatchlistPanel.tsx       # 关注列表 UI
  wallet/{WalletConnectPanel,MultiChainBalances}.tsx
  token/{TokenTransferPanel,BatchedTransferDemo}.tsx
  ui/{Button,Section,Modal,AssetCard}.tsx         # 通用展示层，不含业务 hook

lib/
  auth/
    signedCookie.ts    # sign()/verify() 通用签名 cookie 原语（HMAC + timingSafeEqual）
    siwe.ts            # nonce 签发 + SIWE 签名验证
    session.ts         # 会话签发/校验，全项目唯一的 getSession() 入口
    watchlist.ts        # 关注列表业务逻辑（签名 cookie 存储，与 owner 地址绑定）
  hooks/
    useSiwe.ts / useSession.ts / useLogout.ts / useWatchlist.ts
    useMultiChainBalance.ts
  chains.ts / rpc.ts / viemClient.ts / wagmiConfig.ts
  eip5792.ts           # 原子批量能力判断的归约函数
  errors.ts / constants.ts / format.ts
```

## Design decisions 设计取舍

### Stateless signed cookies instead of a database 无数据库的签名 cookie 会话

The session (and the watchlist) is a self-contained cookie, HMAC-signed with Node's built-in `crypto`, not a row in a database. A `purpose` string is mixed into the HMAC input as a domain separator, so a nonce cookie can't be replayed as a session cookie even with the same secret, and the watchlist cookie is scoped to the owner's address so it can't be swapped between users. This keeps the whole auth layer serverless/Vercel-friendly with zero infrastructure — the explicit tradeoff is a ~4KB cookie size ceiling (the watchlist caps at 20 addresses) and no way to revoke a session before it expires short of rotating the secret. A production system handling real money would put sessions in a database or Redis instead, precisely to get instant revocation.

会话(以及关注列表)是一个自包含的签名 cookie,用 Node 内置的 `crypto` 做 HMAC 签名,不是数据库里的一行记录。HMAC 输入里混入了一个 `purpose` 字符串作为"域隔离"——同一个密钥签出来的 nonce cookie 不能被冒充成 session cookie,关注列表 cookie 也绑定了 owner 地址,不能被跨用户挪用。这样整个鉴权层完全无状态,可以直接跑在 serverless/Vercel 上,不需要额外的基础设施——明确的代价是 cookie 大小上限(~4KB,关注列表因此设了 20 个地址的上限),以及没法在过期前主动撤销某个 session(除非轮换密钥)。真正涉及资金的生产系统,这里应该换成数据库或 Redis 存 session,为的就是能立即撤销。

### EIP-5792 capability detection, not silent fallback EIP-5792 能力检测,而不是悄悄降级

`useCapabilities` reports one of three states per chain: `supported`, `ready` (atomic execution is possible but needs a one-time account upgrade, which the wallet handles transparently inside the same `wallet_sendCalls` call), or `unsupported`. The demo submits `forceAtomic: true` so an unsupported wallet fails loudly instead of silently executing the two transfers non-atomically — the UI then explicitly falls back to two sequential transactions and says outright that a failure partway through won't roll back the first one. The point of this demo isn't "call a new API" — it's demonstrating that atomicity is a guarantee you have to detect and communicate, not assume.

`useCapabilities`会针对每条链返回三种状态:`supported`、`ready`(能做到原子执行,但需要先做一次性账户升级,这一步钱包会在同一次 `wallet_sendCalls` 调用里透明处理)、或 `unsupported`。demo 提交时带上 `forceAtomic: true`,这样不支持的钱包会直接报错失败,而不是悄悄把两笔转账拆成非原子执行——UI 会明确降级成两笔顺序交易,并直接告诉用户"中途失败不会撤销第一笔"。这个 demo 的价值不在于"调通了一个新 API",而在于证明原子性是一个需要主动检测、并诚实告知用户的保证,不能默认它存在。

### Why Route Handlers aren't unit-tested directly 为什么没有直接给 Route Handler 写单测

`next/headers`'s `cookies()` relies on Next.js's request-scoped `AsyncLocalStorage` context — calling a Route Handler's exported `GET`/`POST` function directly from a test throws `cookies was called outside a request scope`, confirmed empirically while building this test suite. Rather than pull in extra test-only infrastructure (e.g. `next-test-api-route-handler`) to fake that context, every function under `lib/auth/*` was designed to take the cookie value as an explicit parameter instead of calling `cookies()` internally — so the business logic is fully unit-testable, and the thin Route Handler wrapper (parse the request, call `cookies()`, call the tested function, set the response cookie) is covered by manual verification via `request.http`.

`next/headers` 的 `cookies()` 依赖 Next.js 请求作用域的 `AsyncLocalStorage` 上下文——在测试里直接调用 Route Handler 导出的 `GET`/`POST` 会抛出 `cookies was called outside a request scope`(这是搭建这套测试时实际验证过的,不是猜的)。与其为了伪造这个上下文引入额外的测试专用依赖(比如 `next-test-api-route-handler`),`lib/auth/*` 下的每个函数从设计时就把 cookie 值作为显式参数传入,而不是在内部调用 `cookies()`——这样业务逻辑本身可以完整单测,那层薄薄的 Route Handler 包装(解析请求、调 `cookies()`、调已测试过的函数、写回 cookie)则用 `request.http` 手动验证覆盖。

### Why Vitest 为什么选 Vitest

Next.js's own testing guide recommends it for the App Router; it shares config with Vite (`vite-tsconfig-paths` resolves the same `@/` alias used across the app), and starts in-process with no separate server to manage, which matters for a CI pipeline that needs to run in seconds without any secrets configured.

Next.js 官方测试指南给 App Router 推荐的就是 Vitest;它能直接复用 Vite 的配置(`vite-tsconfig-paths` 解析和项目里一致的 `@/` 别名),而且是进程内启动,不需要额外管理一个测试服务器——这对一个不配置任何 secret、要求几秒内跑完的 CI 流水线来说很重要。

## Testing 测试

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest run
npm run test:watch  # vitest (watch mode)
```

Covered: the signed-cookie primitive (round-trip, tampering, expiry, purpose isolation), SIWE sign-in verification (real offline-generated signatures via `viem/accounts`, covering nonce/domain/signature rejection paths), watchlist business logic (add/remove/duplicate/limit), the EIP-5792 capability reducer, error-message mapping, and the multi-chain balance hook. `.github/workflows/ci.yml` runs lint + typecheck + test on every push/PR — no secrets required, since every secret (`AUTH_COOKIE_SECRET`, the Alchemy key) is read lazily at call time, not asserted at module load.

覆盖范围:签名 cookie 原语(往返、篡改、过期、purpose 隔离)、SIWE 登录验证(用 `viem/accounts` 离线生成真实签名,覆盖 nonce/domain/签名各种拒绝场景)、关注列表业务逻辑(增删、去重、上限)、EIP-5792 能力归约函数、错误信息映射、多链余额 hook。`.github/workflows/ci.yml` 在每次 push/PR 上跑 lint + typecheck + test,不需要配置任何 secret——因为所有 secret(`AUTH_COOKIE_SECRET`、Alchemy key)都是调用时才惰性读取,不是模块加载时就断言存在。

## Known limitations 已知局限

- The EIP-5792 atomic path hasn't been manually verified end-to-end against a real atomic-capable wallet yet (only the sequential fallback path has been exercised live) — it's covered by unit tests on the capability-reducing logic, not a live atomic transaction.
  EIP-5792 的原子路径还没有用真实支持原子批量的钱包完整手动测过(目前实际连过的只有顺序降级路径)——单测覆盖的是能力判断的归约逻辑,不是一次真实的原子交易。
- No mocking (`vi.mock`) or component-level Testing Library examples yet (`render`/`screen`/`userEvent`) — every test so far is against pure functions designed to avoid needing mocks in the first place.
  目前还没有用到 mock(`vi.mock`)或者组件级的 Testing Library 测试(`render`/`screen`/`userEvent`)——目前所有测试测的都是刻意设计成不需要 mock 的纯函数。
- Watchlist is capped at 20 addresses by the ~4KB cookie size limit, and there's no way to revoke a session before it expires other than rotating `AUTH_COOKIE_SECRET` (which invalidates every session at once).
  关注列表因为 cookie ~4KB 的大小限制,上限是 20 个地址;而且没法只撤销某一个 session,除非轮换 `AUTH_COOKIE_SECRET`(会让所有 session 一起失效)。

## Security practices 安全实践

- **Env var tiering 环境变量分级**：`NEXT_PUBLIC_` 前缀的变量会被打进浏览器 bundle,`AUTH_COOKIE_SECRET` 不加这个前缀,仅服务端可见。
- **Constant-time comparison 恒定时间比较**：session/watchlist cookie 校验用 `crypto.timingSafeEqual`,避免签名比较时的时序侧信道。
- **Domain separation 域隔离**：HMAC 签名混入 `purpose` 字符串,防止不同用途的 cookie 互相冒充。
- **Least-privilege transfers 最小必要授权**：转账金额按需指定,不采用无限额度授权。
- **No secrets in source 敏感信息隔离**：私钥/助记词/密钥不进代码、不进日志、不进版本控制。

## Local setup 本地运行

1. Create `.env.local` (gitignored)：
   ```
   NEXT_PUBLIC_ALCHEMY_API_KEY=your-alchemy-api-key
   AUTH_COOKIE_SECRET=$(openssl rand -base64 32)
   ```
2. Install & run 安装并启动：
   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) — needs a browser wallet extension (MetaMask-compatible) switched to Sepolia. 需要浏览器安装钱包扩展并切换到 Sepolia 测试网。

## Roadmap

- [x] Multi-chain balance reading 多链余额读取
- [x] Wallet connect / disconnect / chain switching 钱包连接/断开/切链
- [x] SIWE sign-in + stateless session SIWE 登录 + 无状态会话
- [x] Session-gated watchlist 登录门槛下的关注列表
- [x] EIP-5792 atomic batch transfer + honest fallback 原子批量转账 + 诚实降级
- [x] ERC20 / native ETH transfer with pre-flight simulation 带预检查的 ERC20/ETH 转账
- [x] Unit tests + CI 单元测试 + CI
- [ ] Mocking + component-level tests mock 与组件级测试
- [ ] Manual end-to-end verification of the atomic EIP-5792 path 原子路径的真实端到端验证
- [ ] WalletConnect for mobile wallets 接入 WalletConnect,支持移动端钱包
