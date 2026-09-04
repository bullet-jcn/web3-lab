# web3-lab

A production-oriented Next.js + wagmi/viem wallet companion: Sign-In with Ethereum, revocable sessions, a database-backed watchlist, transaction-safety workflows, and EIP-5792 atomic batching with an honest non-atomic fallback.

基于 Next.js + wagmi/viem 构建的生产导向钱包伴侣：包含 SIWE 登录、可撤销会话、数据库关注列表、交易安全流程，以及带诚实非原子降级的 EIP-5792 原子批量调用。

## Features 功能

- **Wallet selection / multi-chain balances** — explicit injected-wallet or WalletConnect selection, honest connecting/reconnecting/rejection states, Sepolia + Ethereum mainnet switching, and per-chain balances via `useQueries`. WalletConnect is registered only when a public Reown project ID is configured.
  钱包选择与多链余额——明确选择浏览器钱包或 WalletConnect，区分连接中、恢复中和拒绝状态；支持 Sepolia / Ethereum 切链，并用 `useQueries` 并行查询每条链。只有配置公开的 Reown project ID 后才注册 WalletConnect。
- **Sign-In with Ethereum (EIP-4361)** — Redis one-time nonce → wallet signature → server-side verification via `viem/siwe` → opaque revocable session whose token hash is stored in PostgreSQL. The original signed-cookie implementation remains an explicit emergency rollback mode.
  SIWE 登录——Redis 一次性 nonce → 钱包签名 → 服务端用 `viem/siwe` 验证 → PostgreSQL 只保存 token hash 的不透明可撤销会话；旧签名 Cookie 仅保留为显式紧急回滚模式。
- **Session-gated watchlist** — add/remove chain-scoped watched addresses in PostgreSQL with transactional ownership and capacity constraints.
  登录后才能使用的关注列表——按用户和链写入 PostgreSQL，并以事务保证所有权、去重和容量边界。
- **EIP-5792 atomic batch transfer** — detects wallet capability via `useCapabilities`, submits two ERC20 transfers as one atomic `useSendCalls` batch when supported, and explicitly falls back to two sequential (non-atomic) transactions — with the UI stating plainly that a mid-sequence failure won't roll back the first transfer.
  EIP-5792 原子批量转账——用 `useCapabilities` 检测钱包能力，支持则把两笔 ERC20 转账合并成一次原子 `useSendCalls`；不支持则显式降级为两笔顺序交易，并在 UI 上明确说明"第二笔失败不会撤销第一笔"。
- **ERC20 / native ETH transfer** — validated address/ENS/address-book/clipboard input, decimal-safe amounts, balances and gas budgets, an exact review snapshot, receipt/replacement tracking across refreshes, and explorer evidence.
  ERC20 / 原生 ETH 转账——校验地址、ENS、地址簿与剪贴板输入，按真实 decimals 处理金额，检查余额和 Gas；钱包前冻结精确 Review 快照，刷新后继续追踪回执/替换交易并提供区块浏览器证据。
- **AI security copilot — pre-signature risk detection** — a deterministic, unit-tested function flags known-dangerous patterns (currently: unlimited ERC20 `approve`); an LLM only phrases the already-computed finding into a plain-language warning, never decides what's risky. Any flagged action requires an explicit "I understand the risk, proceed" confirmation before it's ever signed.
  AI 安全副驾驶——签名前风险检测——确定性、有单测覆盖的函数检测已知风险模式(目前:无限额度 ERC20 `approve`);LLM 只负责把已经算出来的结果转述成人话警告,不负责判断风险本身。任何被标记的操作都需要用户显式点"我已了解风险,继续"才会真正发起签名。
- **Data lifecycle and public operating boundaries** — same-origin authenticated account deletion, bounded retention with preview/apply confirmation, machine-checked restore-drill evidence, release-gated operator contact, and public privacy/terms/risk/support pages.
  数据生命周期与公开运营边界——同源且已认证的账户数据删除、带预览和环境确认的保留清理、机器校验的恢复演练证据、发布门禁中的运营联系人，以及公开的隐私/条款/风险/支持页面。

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
| AI / LLM | Google Gemini API (`@google/genai`) |
| Durable state | PostgreSQL |
| Coordination | Redis |
| Operations | OpenTelemetry + structured redacted logs |

## Directory structure 目录结构

```
app/
  api/
    auth/{nonce,verify,session,logout}/route.ts   # SIWE 登录相关 Route Handlers
    watchlist/route.ts                            # 关注列表 CRUD Route Handler
    risk-copilot/route.ts                         # AI 安全副驾驶：结构化风险 → 人话警告
  layout.tsx / page.tsx / providers.tsx

components/
  auth/SignInWithEthereum.tsx        # 登录/登出 UI
  watchlist/WatchlistPanel.tsx       # 关注列表 UI
  wallet/{WalletConnectPanel,MultiChainBalances}.tsx
  token/{TokenTransferPanel,BatchedTransferDemo,ApprovalRiskDemo}.tsx
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
  riskCheck.ts         # 确定性风险检测规则（纯函数，AI 不参与判断）
  walletConnection.ts  # WalletConnect 配置边界与连接错误归约
  errors.ts / constants.ts / format.ts
```

## Design decisions 设计取舍

### Durable sessions with an explicit rollback mode 可撤销会话与显式回滚模式

Production mode uses Redis for consume-once SIWE nonces and fast revocation checks, while PostgreSQL is the durable source of truth for opaque session-token hashes and chain-scoped Watchlists. A dependency outage fails closed instead of silently treating missing state as authenticated or empty. The earlier signed-cookie implementation remains available only through explicit `BACKEND_STORAGE_MODE=legacy-cookie` incident rollback; switching formats may require users to sign in again and does not expose PostgreSQL Watchlists until normal mode returns.

生产模式使用 Redis 保存可原子消费的 SIWE nonce 和撤销快速路径，PostgreSQL 则作为不透明 Session token hash 与按链 Watchlist 的长期事实源。依赖故障时系统 fail closed，不会把“查不到”静默解释成已认证或空数据。旧签名 Cookie 只通过显式 `BACKEND_STORAGE_MODE=legacy-cookie` 用于事故回滚；切换格式可能要求用户重新登录，恢复正常模式前也不会假装能读取 PostgreSQL Watchlist。

### EIP-5792 capability detection, not silent fallback EIP-5792 能力检测,而不是悄悄降级

`useCapabilities` reports one of three states per chain: `supported`, `ready` (atomic execution is possible but needs a one-time account upgrade, which the wallet handles transparently inside the same `wallet_sendCalls` call), or `unsupported`. The demo submits `forceAtomic: true` so an unsupported wallet fails loudly instead of silently executing the two transfers non-atomically — the UI then explicitly falls back to two sequential transactions and says outright that a failure partway through won't roll back the first one. The point of this demo isn't "call a new API" — it's demonstrating that atomicity is a guarantee you have to detect and communicate, not assume.

`useCapabilities`会针对每条链返回三种状态:`supported`、`ready`(能做到原子执行,但需要先做一次性账户升级,这一步钱包会在同一次 `wallet_sendCalls` 调用里透明处理)、或 `unsupported`。demo 提交时带上 `forceAtomic: true`,这样不支持的钱包会直接报错失败,而不是悄悄把两笔转账拆成非原子执行——UI 会明确降级成两笔顺序交易,并直接告诉用户"中途失败不会撤销第一笔"。这个 demo 的价值不在于"调通了一个新 API",而在于证明原子性是一个需要主动检测、并诚实告知用户的保证,不能默认它存在。

### Deterministic risk detection, AI only phrases it 风险判断是确定性代码，AI 只负责转述

The AI security copilot deliberately splits into two pieces with a hard boundary: `lib/riskCheck.ts` is a pure, synchronous, fully-unit-tested function that decides whether a call is risky (e.g. an ERC20 `approve` for `maxUint256`) — the LLM is never asked to detect or judge anything. Its only input is the already-computed structured finding (`{severity, code, detail}`), and its only job is turning that into a short, honest warning; the system prompt explicitly forbids inventing risks beyond the given data, and requires saying "no known risk detected" instead of implying safety when nothing was found. This split also paid off directly: the route handler was originally built against the Anthropic API, then switched to Gemini's free tier mid-project (an account credit issue, not a design change) — and that swap touched exactly one file. `riskCheck.ts`, its tests, and the UI didn't change at all.

AI 安全副驾驶刻意拆成两个边界清晰的部分:`lib/riskCheck.ts` 是一个纯函数、同步、有完整单测覆盖,负责判断一次调用是不是有风险(比如 ERC20 `approve` 传了 `maxUint256`)——LLM 完全不参与"判断"这一步。它唯一的输入是已经算好的结构化结果(`{severity, code, detail}`),唯一的任务是把这个结果转述成一句诚实的警告;system prompt 里明确禁止在给定数据之外编造风险,也要求"没检测到已知风险"时如实说清楚,而不是暗示"绝对安全"。这个拆分直接带来了一个好处:这个 route handler 最初接的是 Anthropic API,项目中途因为账户余额问题(不是设计原因)换成了 Gemini 的免费额度——这次切换只改了一个文件,`riskCheck.ts`、它的测试、还有 UI 完全没动。

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

Covered: signed-cookie and SIWE boundaries, watchlist behavior, EIP-5792 capability/lifecycle reduction, pending transaction and batch recovery, transfer parsing/balances/gas/review/replacement flows, address book/clipboard/ENS races, wallet selection and WalletConnect failure states, multi-chain balances, API-origin/schema protection, and deterministic risk rules. The suite combines pure unit tests with hook and component tests. `.github/workflows/ci.yml` runs lint + typecheck + test on every push/PR; WalletConnect stays visibly unavailable when its public project ID is absent.

覆盖范围包括签名 cookie / SIWE 边界、关注列表、EIP-5792 能力与生命周期、待确认交易和批次恢复、转账解析/余额/Gas/Review/替换、地址簿/剪贴板/ENS 异步竞态、钱包选择与 WalletConnect 失败状态、多链余额、API Origin/schema 防护以及确定性风险规则；同时包含纯函数、Hook 与组件测试。`.github/workflows/ci.yml` 在每次 push/PR 上运行 lint、typecheck 和 test；缺少公开 project ID 时 WalletConnect 会明确保持不可用。

## Known limitations 已知局限

- The EIP-5792 atomic path hasn't been manually verified end-to-end against a real atomic-capable wallet yet (only the sequential fallback path has been exercised live) — it's covered by unit tests on the capability-reducing logic, not a live atomic transaction.
  EIP-5792 的原子路径还没有用真实支持原子批量的钱包完整手动测过(目前实际连过的只有顺序降级路径)——单测覆盖的是能力判断的归约逻辑,不是一次真实的原子交易。
- The WalletConnect connector and selection/failure states are covered by component tests and production builds, but a real QR pairing still requires a project-specific Reown ID and manual mobile-wallet evidence; this repository does not claim that live pairing evidence yet.
  WalletConnect connector、选择和失败状态已有组件测试及生产构建证据，但真实二维码配对仍需要项目自己的 Reown ID 和移动钱包手动证据；仓库目前不声称已经完成这项真实配对验证。
- Preview/staging/production configuration, standalone container output and rollback gates are present, but no real cloud URL, alert-delivery incident, backup restore, or production wallet evidence is claimed until those external checks run.
  仓库已具备 Preview/Staging/Production 配置边界、standalone 容器产物与回滚门禁，但在真实外部验证发生前，不声称已有云端 URL、告警送达、备份恢复或生产钱包证据。
- Only one risk rule is implemented so far (unlimited ERC20 `approve`) — an intentionally narrow, honestly-scoped MVP, not a claim of comprehensive risk coverage. Adding a new rule means adding a new case to `assessRisk()`; the AI-phrasing layer needs no changes.
  目前只实现了一条风险规则(无限额度 ERC20 `approve`)——这是刻意做小、诚实标注范围的 MVP,不是"全面风险覆盖"的承诺。加一条新规则只需要在 `assessRisk()` 里加一个分支,AI 转述那层完全不用改。

## Security practices 安全实践

- **Env var tiering 环境变量分级**：`NEXT_PUBLIC_` 前缀的变量会被打进浏览器 bundle,`AUTH_COOKIE_SECRET` 不加这个前缀,仅服务端可见。
- **Constant-time comparison 恒定时间比较**：session/watchlist cookie 校验用 `crypto.timingSafeEqual`,避免签名比较时的时序侧信道。
- **Domain separation 域隔离**：HMAC 签名混入 `purpose` 字符串,防止不同用途的 cookie 互相冒充。
- **Least-privilege transfers, now with a real detector 最小必要授权，现在有代码把关**：`lib/riskCheck.ts` flags unlimited-approval (`maxUint256`) calls before they're ever signed — previously this was just a README claim with no code behind it.
  之前这一条只是 README 里的一句话,现在 `lib/riskCheck.ts` 会在签名前真正检测并拦截无限额度授权(`maxUint256`)的调用。
- **No secrets in source 敏感信息隔离**：私钥/助记词/密钥不进代码、不进日志、不进版本控制。

## Local setup 本地运行

1. Create `.env.local` (gitignored)：
   ```
   NEXT_PUBLIC_ALCHEMY_API_KEY=your-alchemy-api-key
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id  # optional; from cloud.reown.com
   AUTH_COOKIE_SECRET=$(openssl rand -base64 32)
   GEMINI_API_KEY=your-gemini-api-key   # optional — only needed for the AI risk copilot; free, no card required, at aistudio.google.com/apikey
   ```
2. Install & run 安装并启动：
   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000), choose an injected wallet or configured WalletConnect, then switch to Sepolia for write-path testing. 打开页面后选择浏览器钱包或已配置的 WalletConnect，再切换到 Sepolia 测试写路径。

## Roadmap

- [x] Multi-chain balance reading 多链余额读取
- [x] Wallet connect / disconnect / chain switching 钱包连接/断开/切链
- [x] SIWE sign-in + stateless session SIWE 登录 + 无状态会话
- [x] Session-gated watchlist 登录门槛下的关注列表
- [x] EIP-5792 atomic batch transfer + honest fallback 原子批量转账 + 诚实降级
- [x] ERC20 / native ETH transfer with pre-flight simulation 带预检查的 ERC20/ETH 转账
- [x] Unit tests + CI 单元测试 + CI
- [x] AI security copilot: deterministic pre-signature risk detection + LLM phrasing AI 安全副驾驶:签名前确定性风险检测 + LLM 转述
- [x] Mocking + component-level tests mock 与组件级测试
- [ ] Manual end-to-end verification of the atomic EIP-5792 path 原子路径的真实端到端验证
- [x] WalletConnect connector + wallet selection WalletConnect connector 与钱包选择
