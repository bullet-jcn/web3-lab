# Milestone 4 延后学习课程：后端与生产运维

状态：**学习暂停，代码优先**。用户下次说“学习第四阶段”时，从本文件第 1 课开始，
不重新开发、不依赖旧聊天记录，也不要直接从 SQL 语法讲起。

## 先建立的具象模型

把当前浏览器应用想成一家准备正式营业的银行网点：

- PostgreSQL 是总账和档案室。用户、会话、交易意图、回执和风险决定属于长期事实，
  不能因为进程重启或缓存过期而消失。
- Redis 是前台的号码牌、闸机和短期告示。nonce、限流计数和“这次请求正在处理”需要快、
  需要原子操作，但到期后应该自动消失。
- Repository 是档案室窗口。业务代码提出“按 token hash 找有效 Session”，而不是到处自己
  拼 SQL；以后换连接池、加审计或测试替身时，业务规则不会被数据库细节淹没。
- Migration 是有编号、不可涂改的账本改版记录。已经上线的 migration 只能新增下一版，
  不能偷偷改旧文件，否则不同环境会拥有名字相同、结构不同的数据库。
- 可观测性是仪表盘和报警器。系统不仅要“通常能跑”，还要让运营者知道哪里坏了、影响谁、
  如何止损和恢复，同时看不到用户私钥等敏感信息。

## 学习总路线

每课固定分四段：生活化场景 → 业界边界 → 本项目代码 → 小练习。先理解为什么，再读实现。

### 第 1 课：为什么浏览器状态不等于后端事实

要回答：Cookie、localStorage、数据库、缓存各自能证明什么？刷新、换设备、服务重启后什么
必须还在？为什么交易 Hash 是公开恢复证据，而签名和私钥绝不该保存？

代码入口：

- `lib/pendingTransactionStorage.ts`
- `lib/auth/session.ts`
- `docs/BACKEND_FOUNDATION.md`

### 第 2 课：PostgreSQL 是怎样表达业务关系的

从一位用户可以绑定 wallet 开始，画出 user → wallet → session / intent → receipt / risk report。
重点理解 primary key、unique、foreign key、复合外键和 `ON DELETE`，以及为什么不能只依赖
TypeScript 类型保证数据库永远正确。

代码入口：`migrations/0001_backend_foundation.sql`

### 第 3 课：Migration 与 Repository 为什么要分开

Migration 决定数据结构如何演进；Repository 决定业务可以做哪些读写。学习参数化查询如何阻止
SQL 注入、连接池为什么不能每次请求新建、一个 Receipt 与 intent 终态为什么必须在同一事务。

代码入口：

- `scripts/migrate.mjs`
- `lib/server/db/client.ts`
- `lib/server/db/repositories.ts`

### 第 4 课：Redis 为什么不能当总账

用“一次性门票”理解 SIWE nonce，用“窗口内叫号次数”理解 rate limit，用“订单受理号”理解
idempotency。重点区分 TTL、`SET NX`、`GETDEL` 和 Lua 原子脚本，并讨论 Redis 丢数据时哪些
功能应该失败、哪些长期事实不能丢。

代码入口：

- `lib/server/redis/coordinator.ts`
- `lib/server/redis/client.ts`

### 第 5 课：可撤销 Session 与登录生命周期

完整走一遍：签发 nonce → 钱包签 SIWE → 校验 domain/URI/chain/signature → 原子消费 nonce →
生成随机 bearer token → 数据库只存 token hash → Cookie 只存原 token → 请求认证 → logout 撤销。
重点理解为什么“签名正确”不等于 Session 永久有效，以及数据库/Redis 故障时为什么安全产品倾向
fail closed。

代码入口：

- `lib/auth/siwe.ts`
- `lib/server/auth/nonceService.ts`
- `lib/server/auth/sessionService.ts`
- `app/api/auth/nonce/route.ts`
- `app/api/auth/verify/route.ts`
- `app/api/auth/session/route.ts`
- `app/api/auth/logout/route.ts`

### 第 6 课：Watchlist 为什么要从 Cookie 搬到数据库

比较“整个列表塞进签名 Cookie”和“Cookie 只带 Session、列表属于用户数据库记录”。学习多设备、
容量限制、并发添加、重复地址和 chain scope；理解签名只能防篡改，不能提供服务端查询、撤销和
运营能力。

代码入口：

- `lib/auth/watchlist.ts`（旧边界）
- `app/api/watchlist/route.ts`
- `lib/server/db/repositories.ts`（新边界）

### 第 7 课：交易意图、广播和 Receipt 为什么是三种事实

Review 时的 intent、钱包返回 Hash 后的 broadcast、链上 Receipt 的 success/reverted 分别证明
不同阶段。学习 idempotency key 与 request fingerprint 如何阻止重复请求，以及 replacement
为什么必须保留旧、新 Hash 的关系。

代码入口：

- `lib/transactionState.ts`
- `lib/server/db/repositories.ts`
- `migrations/0001_backend_foundation.sql`

### 第 8 课：风险证据的数据最小化

数据库只保存确定性 finding code、severity 和用户决定；AI 文案不是风险事实，原始 calldata、
typed data、签名和私钥也不应该为了“以后分析”就长期收集。学习数据最小化、保留期限和删除
请求之间的关系。

### 第 9 课：RPC 可靠性不是无限重试

学习多提供商 fallback、timeout、每次操作的 retry budget、健康检查和熔断。重点理解读取可以
安全重试到什么程度，钱包写请求为什么绝不能由服务端无条件重发。

代码入口：

- `lib/rpc.ts`
- `lib/viemClient.ts`
- `lib/wagmiConfig.ts`
- `lib/server/rpcHealth.ts`
- `app/api/health/rpc/route.ts`
- `docs/RPC_OPERATIONS.md`

### 第 10 课：日志、监控、CI、部署与恢复

把生产运维串成闭环：结构化脱敏日志 → error/performance monitoring → alert → runbook → rollback →
backup restore drill。再看依赖/秘密扫描、preview/staging/production 隔离、隐私/条款/支持流程。

先用“医院急诊监护仪”理解三个信号：日志说明某次事件发生了什么，metric 说明一段时间内发生了
多少次/多慢，trace 把一次请求经过的步骤连起来。告警不是看到一条 error 就叫醒所有人，而是把
持续时间、最少样本量、严重性和 runbook 固化成运营规则。日志字段必须低基数且脱敏；钱包地址、
Cookie、请求体、签名、calldata、RPC URL 与异常 message/stack 都不进入本项目的运营日志。

代码入口：

- `instrumentation.ts`
- `lib/server/observability/logger.ts`
- `lib/server/observability/route.ts`
- `lib/server/serviceHealth.ts`
- `app/api/health/ready/route.ts`
- `ops/alerts/rules.json`
- `docs/OBSERVABILITY.md`
- `.github/workflows/security.yml`
- `.github/dependabot.yml`
- `docs/DEPENDENCY_SECURITY.md`

## 当前代码进度快照

已实现：第一版 schema、迁移器、Repository、Redis Coordinator、本地 Compose、单元测试和 CI
真实服务集成测试入口。

已实现：SIWE nonce、可撤销 Session、Watchlist 后端接入，以及必须显式选择的生产存储模式。

已实现：RPC provider registry、fallback、timeout、有限 attempt budget、CSP provider origin 和
健康状态端点。

已实现：结构化脱敏 Route 日志、request/trace correlation、OpenTelemetry 错误与性能接入、
PostgreSQL/Redis/RPC 就绪检查、版本化告警规则与故障 runbook。监控平台和接收人需要在具体
部署环境配置并保存告警送达证据，仓库不会伪造它已经发生。

已实现：锁文件审计门禁、PR Dependency Review、完整 Git 历史 Secret Scan、GitHub Action
不可变 SHA 固定、Dependabot 周期更新和依赖安装脚本精确版本许可。安全工作流只有推送到 GitHub
并执行后才能成为远端证据；Branch Protection 仍需仓库管理员配置为必需检查。

尚未开始：部署环境、备份与数据政策。当前只有应用级
存储模式回滚，尚不等于完整发布/数据库回滚方案。

## 学完后的验收问题

最终应能用自己的话回答：

1. 为什么 PostgreSQL 和 Redis 不是二选一？
2. 为什么 Cookie 里的 Session token 与数据库里的 token hash 必须分开？
3. 为什么同一个 idempotency key 配上不同 request fingerprint 必须拒绝？
4. 为什么 Redis 丢失不能导致交易历史消失？
5. 为什么运营日志能帮助排障，却仍然不能记录签名、私钥或完整敏感 payload？
6. 一次数据库故障发生后，操作者如何检测、止损、回滚和恢复？
