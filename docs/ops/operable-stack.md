# 可运行中间件栈（非生产级）

目标：Docker 里把 **PostgreSQL、Redis、Elasticsearch、Mongo、S3 兼容存储** 拉起来，入库和检索能互相打到这些服务。  
**不是** 真杀毒、**不是** IK 生产集群、**不是** 改仓库默认 mock（CI 仍走 mock）。

> **本机真跑记录**（2026-09-29）：[real-stack-evidence.md](./real-stack-evidence.md) —— 五服务 healthy、真 PG 迁移 23/23 零漂移、端到端入库真跑通、真 ES 中文检索与 `aclPrincipals` 三态实测，以及 ask 段要一台真 Gateway 的边界。

## 1. 起中间件

```bash
docker compose -f docker/docker-compose.yml up -d
```

| 服务 | 端口 | 作用 |
|------|------|------|
| postgres | 5432 | 主库 + pgvector |
| redis | 6379 | 队列 |
| elasticsearch | 9200 | BM25 sparse（标准分词，未装 IK） |
| mongo | 27017 | parse 正文 |
| rustfs | 9000 / 9001 | 对象存储（官方 RustFS）；首次 `STORAGE_MODE=s3` put 会建桶 `strict-rag` |

## 2. 打开可运行开关

复制 `.env.example` 为 `.env` 后，再把 **`.env.operable.example`** 整份追加进 `.env`（覆盖 mock 默认）。  
不要改 `apps/*/src/env.ts` 的 Zod 默认；CI 仍走 mock。

```bash
cp .env.example .env
cat .env.operable.example >> .env
```

**全新库必须再配一个超管引导（否则 api 起不来）**：`apps/api/src/index.ts:20` 在 `serve()` **之前**无条件跑超管引导，库里没有 active 超管时缺 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 会直接 `process.exit(1)`（`services/superadmin-bootstrap.ts`）。`.env.example` 里这两行是**注释掉的**，追加以下内容进同一个 `.env`：

```bash
# 仅在库里还没有 active 超管时需要；已有超管后这段可留可删
SUPER_ADMIN_EMAIL=admin@local.dev
SUPER_ADMIN_PASSWORD=<自定，勿用示例值>
```

已有超管的环境**不需要**这两行。`development` 下另可用 `POST /api/v1/auth/admin/dev-login` 造主体，但那要求 api **已经在跑**，绕不过首次引导。

追加后同一文件内后出现的键覆盖先前 mock 默认。样例含 http ES、S3、Mongo URL。扫描仍 `INGEST_SCAN_MODE=mock_clean`（development only）。**禁止** `on`。向量默认仍 `INGEST_EMBED_MODE=mock`（dims=8）；要真向量另配 Gateway。`AUTH_ENFORCE` 仍 false。

## 3. 业务进程

```bash
pnpm db:migrate
pnpm up:apps
```

### 评测语料入库 + 映射账本（工单 03 / 04）

把两份评测语料（`fixtures/ingest-samples/*.txt` 与 `fixtures/l2/corpus/*.txt`）送入某个 KB，并产出
「逻辑 id → documents.id」映射账本（`artifacts/eval-corpus-ledger-<kbId>.json`，运行产物不入库）：

```bash
# 新建 KB（或 INGEST_KB_ID=<kb-uuid> 复用既有）；打印 kbId 与账本路径
INGEST_KB_NAME=eval-corpus-kb pnpm --filter @strict-rag/api exec tsx src/scripts/ingest-eval-corpus.ts

# 跑 L1 / L2 时按账本把逻辑 id 解析为 uuid（不传 = 与今天逐位一致）
L1_KB_ID=<kbId> L1_DOC_MAP=artifacts/eval-corpus-ledger-<kbId>.json \
  pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
L2_KB_ID=<kbId> L2_DOC_MAP=artifacts/eval-corpus-ledger-<kbId>.json \
  pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
```

账本 `kbId` / `corpusFingerprint` 与本次 KB / 当前夹具不符即拒跑（exit 2）。**跑批前还会做一次库内对账**（2026-10-01 起）：账本每条 `docId` 都要在当前 KB 的 `documents` 里查到、且该行 `status=ready` ∧ `lifecycle=active`、且 title 与账本条目逐字相符；不满足则按三类（`missing` / `not_retrievable` / `title_mismatch`）**拒跑并在消息里点名逻辑 id + 文档 id + 可得时的实测姿态**。这不是洁癖：重跑入库会为同一 KB 生成新 uuid、旧行落 `superseded` **却仍在库**，只查「存在」会放行一批必然假 miss。缺映射**继续算 miss**，绝不变成「该门不适用」。`retrieve_mode` 仍以 env 为准；mock 数字禁止写入签字页。

**worker 队列路径（运营台发起 → BullMQ → worker）**：worker 进程同样设 `L1_DOC_MAP` / `L2_DOC_MAP`（与 CLI **同名同义**，来源 = worker 进程环境，**不是** job payload），worker 消费 `sr-eval` job 时**每次重读**账本文件、并在 `hitAtKCase` 之前把逻辑 id 解析为 uuid。四态：

- **未设置**（空 / 纯空白）→ 与不接账本时逐位一致：报告三键 `docMapSource` / `docMapResolved` / `docMapUnmappedIds` = `none` / `0` / `[]`，缺映射继续算 miss；
- **设置但账本不可用**（缺文件 / 非 JSON / 形状违约 / `kbId` 或语料指纹不符 / **对账查询本身失败**）→ 该 job **响亮失败**（`eval_runs.status=failed` + `error_message` 复用账本错误原文），**绝不**降级成「未设置」；
- **设置但库内对账不过**（`missing` / `not_retrievable` / `title_mismatch`）→ 同样**响亮失败**，错误信息是对账那一类；
- **设置且自洽** → 解析。

worker 换账本须**重启进程**（env 是模块加载期快照）。判定仍在 api 侧、worker 只落库；三键、对账结论与 L1 §8 的题源两键（`goldSource` / `goldSetMatchesRepoFile`）都不进任何判定。

`pnpm up:apps` = compose 中间件（若未起）+ api + worker，不必手拼四进程。仅中间件：`node scripts/up-stack.mjs --compose-only`。

### 一键起全部（含 web / admin）与日志

`pnpm up:apps` 只管 api + worker。要连前端一起起、并且每个程序有独立日志可查：

```bash
pnpm dev                     # compose（起容器）→ 等 postgres/redis healthy → db:migrate → 四进程
pnpm dev --mode=start        # 以 start 模式跑（web / admin 需先 pnpm build，缺 .next 会预检拦下）
pnpm dev --tui               # 改用 turbo TUI 面板（该模式日志不落盘）
pnpm dev --apps=api,worker --no-compose --no-migrate   # 只补起部分进程
pnpm dev --ready-timeout=300                            # 就绪探测上限改 300s（默认 180s；慢机 / CI 冷启动）

pnpm logs                    # 列出已落盘的应用日志（大小 / 最后写入时间）
pnpm logs api -f             # 跟随单个程序（worker / web / admin 同理）
pnpm logs all                # 四个应用各末尾 N 行
pnpm logs docker postgres    # 容器日志（redis / elasticsearch / mongo / rustfs 同理）
pnpm stack:down              # 停记录里的进程 + compose down（数据卷默认保留）
```

`pnpm dev:all` 与 `pnpm dev` 等价；`pnpm dev:turbo` 只跑 turbo 面板（不含 compose / migrate），同样带 `--env-mode=loose`，避免 strict env 把 operable 变量滤掉。

起完会轮询探针（api `/ready`、web / admin 首页、worker 日志行），就绪时打印一行：

```bash
[dev:all] STACK_READY (10.2s) api=http://127.0.0.1:4000 worker=ok web=http://127.0.0.1:3005 admin=http://127.0.0.1:3006
```

同时把状态写进 `.data/run/status.json`（`ready` / `readyMs` / `aborted` / 各进程 pid·端口·就绪明细 / 各日志本次运行起始偏移）。
加 `--no-wait-ready` 可跳过探测（此时 `ready` 为 `null`）。

### 收敛口径（全自动化测试要的是「尽快失败」）

| 情形 | 行为 |
|------|------|
| 中间件 | `docker compose up -d` 起容器即返回；随后**只对硬依赖** `postgres` / `redis` 把门（上限 120s）。硬依赖 healthy 才继续 |
| 硬依赖容器 `exited` / `dead` | **立即报错**（不再等到超时），提示 `pnpm logs docker <postgres\|redis>` |
| 可选服务 `elasticsearch` / `mongo` / `rustfs` 未就绪 | 只打一行 WARN（mock 路径不受影响），**不阻塞**启动 |
| 应用进程在就绪前退出 | 立即收敛：打印 `STACK_NOT_READY` + `提前收敛：<app> 进程已退出（exit=N）` + 日志指引，停掉其余进程并以非零码退出 |
| 应用日志出现启动致命标记 | 同样提前收敛。标记取自仓内真实致命路径：`env 校验失败` · `superadmin bootstrap failed` · `Redis 不可达，worker 退出` · `EADDRINUSE` · `Cannot find module`。这类失败在 `tsx watch` 下**进程不会退出**（watch 留在原地等文件变更），所以只能按日志内容认；发现标记后给 watch 一次重启机会（10s 宽限），仍不就绪才收敛，并打印命中的那一行 |
| 就绪超时（默认 180s） | 打印 `STACK_NOT_READY` + 未就绪项，**停掉本次进程**并以非零码退出（日志已落盘可查）。命中上面两条早收敛信号的场景不会耗到这个上限 |
| 已有栈在跑 | 早退并指名「pid / 起于 / 应用」，给 `pnpm logs` 与 `pnpm stack:down` 两条路（`--no-port-check` 可跳过这层） |
| `compose up` / `db:migrate` / `compose down` 卡住 | 分别有 600s / 180s / 120s 超时，超时按树杀并以退出码 `124` 回报 |

失败态都落到 `.data/run/status.json`（`aborted` 记提前收敛原因），所以自动化侧既能读文件也能读退出码。

### 栈体检（自动化测试的前置门）

```bash
pnpm verify:stack              # 人读摘要；任一 FAIL → 退出码非零
pnpm verify:stack --json       # 只打 JSON（Agent / CI 解析）
pnpm verify:stack --no-docker  # 跳过容器健康项
```

核查项：栈状态记录 · api `/health` 与 `/ready`（postgres / redis 硬依赖，es / mongo / s3 / gateway 允许 `skipped`）· web / admin 可服务 · worker 就绪（锚定**本次运行段**，日志是跨次追加的）· 日志新鲜度 · 进程存活 · compose 五服务 running/healthy。报告落 `.data/run/verify-report.json`。

Agent / CI 的推荐序列：`pnpm dev`（等到 `STACK_READY`）→ `pnpm verify:stack`（不为 0 即停）→ 业务烟测（`pnpm smoke:half` / `pnpm demo:ingest`）→ `pnpm stack:down`。`pnpm dev` 自身的失败也会尽快收敛（见上「收敛口径」），所以这条序列不会出现「卡满超时才报错」的等待。

在另一个窗口跑 `pnpm stack:down` 时，正在跑的 `pnpm dev` 会读到停栈标记，把这次收尾认作正常（打印「已停（外部收尾）」并以 0 退出，不再报 FAIL）；`stack:down` 自己也会把 `stoppedAt` 写进 `.data/run/status.json`，即便当时没有编排进程在场。停栈前会先核对身份（记录里的 pid 命令行必须是 `<仓库>/apps/<app>` 或 `pnpm --filter @strict-rag/<app>`）：pid 会被系统复用，核对不上就跳过该 pid 并说明，避免误杀无关进程。若编排进程是被硬杀（例如直接关掉终端窗口），留下的 `tsx watch` / `next dev` 孤儿按记录的 pid 树杀可能沿不到，`stack:down` 会按「命令行指向本仓 `apps/<app>`」兜底清扫，并打印清掉的 `应用#pid`。

**边界**：`verify:stack` 只证明栈级可用（可达 + 就绪），**不**证明业务正确性，**不**证明生产可用；容器健康与 mock 开关仍以本篇与环境变量为准。

日志落点 `.data/logs/<app>.log`（追加写入，已 gitignore）。默认模式**不经 turbo**：turbo 的 `dev` 任务
env 白名单只有 6 个键，strict env 模式会把 `ELASTICSEARCH_URL` / `STORAGE_MODE` / `SUPER_ADMIN_EMAIL`
等过滤掉（见 §6.1），api / worker 会静默退回 mock；`--tui` 模式用 `--env-mode=loose` 绕开这一层。

Mongo 冒烟（须 `MONGODB_URL`）：

```bash
MONGODB_URL=mongodb://127.0.0.1:27017/strict_rag pnpm --filter @strict-rag/worker smoke:mongo
```

端到端烟测（txt→ask 有引用，闸仍 ready∧active；扫描/ES 可 mock）：

```bash
pnpm smoke:half
```

**末步 ask 需要一台同时提供 chat / embeddings / rerank 三条契约的 Gateway**；本机无 key 时末步会拒答（`reason=internal_guard`）并以非零码退出 —— 这是**环境前置**，不是源码缺陷。要看它到底缺什么：`curl -s localhost:4000/ready` 看 `checks.gateway`；三种失败形态的可分辨诊断由脚本直接打印。

无 key 机器上想**验证管道**（不是验证质量）可用**dev-only 抽取式桩**：

```bash
node scripts/stub-gateway.mjs                     # 一个终端（默认 127.0.0.1:4100；打印 dev-only banner）
GATEWAY_BASE_URL=http://127.0.0.1:4100 pnpm smoke:half   # 另一个终端
```

桩**只从提示里的 EVIDENCE 抽取**（引用逐字取自 evidence，证据不足即 `insufficient:true`），生产档位**拒绝启动**，`smoke:half` 的输出会标注 `gateway=stub`。**用桩通过的 `PASS` 只证明管道接对，不是质量证据、不得进签字包**，也**不是相关性判据**（抽取按单字 token 重叠，与语料无关但共享单字的问题仍可能 `answered`）；仓库默认（无 Gateway → 拒答）一个字未改。

清单：[half-smoke.md](./half-smoke.md)。引用判定单测：`node --test scripts/smoke-ask.test.mjs`。

试点打开 `AUTH_ENFORCE`（**不**改仓库默认）：[auth-enforce-pilot.md](./auth-enforce-pilot.md)。

`GET http://127.0.0.1:4000/ready` 期望：

- `postgres` / `redis` = `up`（硬依赖）
- `elasticsearch` / `mongo` = `up`（配了 URL 才会探测）
- `s3` = `up` **仅在桶已存在之后**：桶由**首次 `putObject`** 时创建（`apps/api/src/services/storage.ts` 的 `ensureReady`），故新起的 RustFS 上、第一次上传之前它恒为 `down`；这不是故障
- `gateway` = `skipped`（未配 `GATEWAY_BASE_URL`）

## 4. 链路

1. admin/api 上传 → api 代理 PUT 写入 RustFS  
2. worker parse 读 S3 → 正文 upsert Mongo → `mongoDocId` = 真 docId  
3. worker es_index bulk 到 ES（字段与检索 `es-sparse` 对齐）  
4. 运营把文档 `lifecycle` 升到 `active`（双就绪后仍是 **draft**，检索闸 `ready∧active`）  
5. ask 在 `RETRIEVE_ES_MODE=http` 下走 ES BM25，语料闸仍以 PG 为准  

## 5. 明确不是

- QUAL-2 真杀毒  
- ES IK / 多租户独立索引 / aclPrincipals 全文 / 仓库默认开 `DEPT_ACL_ENFORCE`  
- 仓库默认 `AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / rewrite  
- 生产 IdP、盘上加密五面全绿  

## 6. 本机排障（2026-09-29 真跑实测三条，非仓库缺陷）

1. **`pnpm dev:api` 起来后 operable env 全被过滤掉**：`dev:api` 走 `turbo run dev`，而 `turbo.json` 的 `dev` 任务 env 白名单只有 6 个键（`APP_ENV` / `API_BASE_URL` / `DATABASE_URL` / `REDIS_URL` / `NEXT_PUBLIC_APP_ENV` / `NEXT_PUBLIC_API_BASE_URL`），turbo 的 strict env 模式会把 `ELASTICSEARCH_URL` / `STORAGE_MODE` / `SUPER_ADMIN_EMAIL` 等**全部过滤掉** → api 以 mock/local 起来（`GET /ready` 里 es/s3/mongo 全 `skipped`）。**绕法**：不经 turbo 起，例如 `pnpm --dir <app 绝对路径> dev`；官方配方 `pnpm up:apps` 用 `pnpm --filter <包> start`，**同样不经 turbo**，故不受影响。
2. **`pnpm --filter @strict-rag/api` 在 PowerShell 下传参失败**：包名里的 `@` 与 `--filter` 在 PowerShell 调 `pnpm.cmd` 时被 shell 拼接破坏（报 `Unknown option: 'filter @strict-rag/api dev'`）。**绕法**：用 `pnpm --dir <app 绝对路径> <script>`。
3. **Docker Desktop 自退后 ES host 端口转发可能丢失**：Docker 重启后五服务都 healthy，`docker compose ps` 也显示 `0.0.0.0:9200->9200/tcp`，但 host 侧连不上（容器内 `_cluster/health` 正常）。**绕法**：`docker compose restart elasticsearch`，约 9 秒恢复；PG / Redis / Mongo / S3 的转发在重启后正常重建，只有 ES 踩到过这一条。
