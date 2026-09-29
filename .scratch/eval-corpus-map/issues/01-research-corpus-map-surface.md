# 评测语料入库与逻辑 id 映射：现状面核实（决策所需事实）

Label: wayfinder:research
Type: research
Status: claimed

## Question

在动任何代码之前，把本图裁决与实现所需的**事实**核清（只读源码 + 只读夹具 + 只读文档，不起服务）。逐项给出**文件 + 行号 + 原样形状**，不确定的明写「未核实」，**禁止**推断填充。

1. **夹具的逻辑 id 面**：`fixtures/l1/gold.yaml` 与 `fixtures/l2/gold.yaml` 的 case 总数、带 `expectedDocIds` 的条数、去重后的逻辑 id 全清单，以及每个逻辑 id ↔ `fixtures/` 下哪个文件的**绑定关系**（README 表格 vs 其它）。L1 与 L2 的逻辑 id 有无交叉（若同一文件的文档要同时喂两侧，映射账本该是**一份**还是**两份**）？
2. **语料入库的现成面**：`scripts/demo-ingest.mjs` 的完整前置链与它拿到了什么（`upload-url` 回包里除 `docId` 还有哪些字段？`title` 是怎么定的？PUT/complete/approve/scan 各步的幂等性如何）。它**没做**的三件事（不吃 `fixtures/l2/corpus` · 不落映射 · 每次新建 KB）各自的**最小改法**是什么？`scripts/seed-demo.mjs` 与 `scripts/smoke-half.mjs` 有无可复用的 KB/登录/轮询片段？
3. **跑批侧的入参面**：`apps/api/src/scripts/run-l1-golden.ts` 与 `run-l2-golden.ts` 的**全部** env 与 CLI 参数（含 `L1_KB_ID` / `L2_KB_ID` 之类的必填项与缺省行为、`--human-spot` 这类 flag 的解析方式）、gold 加载点、`expectedDocIds` 进入 `hitAtKCase` 的**唯一**位置，以及报告对象里**哪些键是必填 / 被字面量测试钉住**（`apps/api/tests/eval/l2-cli.test.ts` 的 `sampleReport()` 一类）。加一个「映射账本路径」参数 + 一个「映射来源」报告键的**回归面**有多大（列出会被打红的文件与 it）。
4. **报告的严格面**：L1 报告里 `repro`（`@strict-rag/contracts/eval-repro`）与 `mode` / `retrieve_mode` 的现有形状；有没有一个**现成的**位置适合承载「映射来源」三态（有账本 / 无账本 / 账本不可用），还是必须新增键；若新增键，worker 侧有无对应白名单（L2 有 `saveL2Report` 逐键白名单，L1 落库走哪条路）。
5. **账本要写什么才「可核对」**：把逻辑 id 解析为 uuid 之后，**怎么验这个映射还新鲜**（KB 被换 / 文档被删 / 夹具文件被改时怎么发现）。`documents` 表里有哪些**稳定**字段可做锚（`id` / `kbId` / `title` / `createdAt` / `status` / `lifecycle`）？`GET /knowledge-bases/:kbId/documents` 的回包形状与分页语义是什么（能否用来做「账本 ↔ 库内文档」的对账）？`artifacts/` 的 gitignore 语义与既有约定（`docs/ops/real-stack-evidence.md` 怎么记证据的）。
6. **KB 绑定**：L1 批跑要求 `expectedDocIds` 所在的文档与**被检索的那个 KB** 一致 —— 现有 env 里 KB 是怎么传进去的（`L1_KB_ID`？），语料入库入口建 KB 之后这个 id 怎么交给跑批。`docs/ops/` 里现有配方（`operable-stack.md` / `half-smoke.md` / `real-stack-evidence.md`）在哪一处最适合插入「建语料 KB + 出账本」这一步。
7. **口径核对**：把「Hit@20 今天恒 0 且非 null → `hit_at_k_below_min` → `businessPass` 恒 false」这条链**逐跳用源码确认**（`adr046-snapshot.ts` 的 `hitAtKOk` / `businessPass`、`run-l1-golden.ts` 的三处行号）；并核清 `hitAtK == null` 在今天**是否可达**（`scored = 0` 的条件是什么，什么情况下 `expectedDocIds` 全为空）。
8. **侧证**：`docs/module-status/` 里 api / worker 关于 L1 报告与 ADR-046 的既有措辞；`docs/testing/coverage/` 里涉及 Hit@k / 逻辑 id 的行（行号 + 现值 + 影子阻塞方），供回写时对照。

产物：`research/01-corpus-map-surface.md`（分节 + 表格，每条**带路径与行号**）。只读，不改任何文件。

## Answer

（待填）
