# 裁定：三样证据面各落到什么形状

Type: grilling
Status: resolved
Blocked by: 01

## Question

拿研究票 01 的事实，把下面每一问**裁定到可以直接开工**的程度：

1. **人工抽检**
   - 承载面：进 `eval_runs.report_json`（复用既有白名单）／ 新增独立表 ／ 新增命令行 + 报告字段 —— 选哪个，为什么？可审计性、多轮次累积、与 ADR-046 四要素之四（KB 配置快照绑定 `eval_runs`）的关系各是什么？
   - 「错」的口径：哪些情形算「错」？（候选：可答被拒 / 不可答被答 / 引用不指向期望文档 / 结论与 rubric 不符）逐条定「算 / 不算 / 无法机械判定」。
   - 样本范围：「≥20 条」是**单次 run 内**还是**跨 run 累积**？是否要求覆盖 2×2 的四个格子？
   - 进闸方式：`humanSpotChecked != null && >= 20 && humanSpotErrors != null && <= 1`（缺测不放行）—— 确认或修正；并写清「登记面已存在但没人登记」与「登记面不存在」这两种红在报告里如何区分。
2. **校准打分器**
   - 来源三态（live / mock / 缺测）由谁声明：env ／ KB 配置 ／ 调用参数 ／ Gateway 回包 —— 选一个与仓库现有判别同构的做法。
   - mock 分数与缺测都必须让 AUROC 门**不放行**；但**要不要**在报告里把 mock 的 AUROC 值打印出来（带来源标记）以便调试？定「打印但不进判定」还是「根本不打印」。
   - 校准集规模（PRD ≥100 vs 今天 8）：判定处要不要加规模门？加则**是加严**（PRD 写了 ≥100）；不加则记债。选定并说明为什么不是「做成恒 false 空转闸」。
3. **§8 可复现字段**
   - 逐条决定：进报告 ／ 记债（取不到）／ 不属于本图。取不到的**必须**在镜像里写成带销账路径的债。
   - 哈希的对象与算法：「题面 ID 哈希」「校准集哈希」「L2 剧本集哈希」各哈希什么、用什么算法、是否稳定（同一输入跨机器同值）。
   - L2 侧（session 策略版本 / L2 剧本集哈希）与本图**同批**还是**留给下一张图**。
4. **统一纪律**
   - 三样改动如何保证**只加严或逐位等价**（逐项给「旧为真的情形集合 ⊇ 新为真的情形集合」的论证方式）。
   - 新增迁移若无法在真 PG 上 apply，镜像里怎么写「未验证」。
   - 回写清单（镜像 / 覆盖表 / spec / backlog 指针）与收口门禁。
5. **明确不做**：列出本图**不做**的相邻项，防止顺手扩面。

## 答案要求

- 四档处理（**落** / **补源后落** / **记债不成闸** / **不动**）逐项标注，判据 = 「PRD 是不是写死」+「今天有没有数据源」。
- 每条裁定要能一句话说清「按这个做，测试怎么钉它」。
- 不触碰 `prds/00–11`。

---

## Answer

**总判据**：PRD 写死的 → 属实现缺口，**落**；PRD 没写但今天有数据源 → 属实现选择，**落并写清是选择**；PRD 没写且无数据源 → **记债不成闸**（严禁恒 `false` 空转闸）；撞冻结语义 → **不动**（本图不碰）。依据：研究票 01（[Answer](./01-research-l1-evidence-sources.md) · [research/01-evidence-sources.md](../research/01-evidence-sources.md)）。

### 一、人工抽检 → **落**（承载面 = 文件账本 + 报告字段 + CLI 入参，**不建表、不建 HTTP**）

- **为什么不是表**：新增表要配迁移，而本机无法在真 PG 上 apply，且 `meta/` 只到 0021 快照 → 每次都要走「不写 DEFAULT」的规避纪律；更关键的是**本仓已有先例把人证放文件不放库**（`fixtures/l1/RACI.md`，`services/eval-runs.ts` 注释明写 RACI 人签不在库里）。**为什么不是 HTTP**：无 admin 登记控件 → 端点是**无生产者的半接线**，会重蹈 `QUAL-ACL-CAP` 被划出的覆辙。
- **承载面形状**：抽检人写一份 JSON 账本（Zod 校验，schema 进 `packages/contracts`），形状 = `{ evalRunId, sampledBy, sampledAt, checked, errors, items?[{ caseId, wrong, note? }] }`；`checked` / `errors` 为整数且 `errors <= checked`；给了 `items` 时**必须**与两个整数一致（这是唯一机械校验的不变式）。
- **「错」的口径**：**不发明机械口径**（PRD §5/§9/剧本 C/T/签字页必含行全都未定义「错」）——由抽检人按 rubric 判，登记面只承载整数 + 可选明细。发明口径即改冻结语义。
- **样本范围**：按 `evalRunId` 聚合，**单次 run 内** ≥20 条；**不强制**覆盖 2×2 四格（PRD 未写）。
- **进闸**：`humanSpotOk = checked != null && checked >= humanSpotMin && errors != null && errors <= humanSpotErrorMax`；门限一律读 `PILOT_HARD_GATES`，判定处不写裸数字；**缺测不放行**。三个 reason code 各自可分辨：`human_spot_missing`（没给账本）／ `human_spot_below_min`（条数不足）／ `human_spot_errors_above_max`（错超限）。
- **顺序纪律（硬）**：**先建面、再进闸**。测例必须含一条「写一个合法账本 → 该门确实变绿」，以证**不是空转闸**。
- **登记路径**：`--human-spot <path>` 传给既有批跑入口（api CLI 与 worker batch 同构）；缺省 = 缺测。不新增 HTTP。
- **会翻的既有断言（研究票已点名）**：`adr046-hard-gates.test.ts` 的 `bind()` 助手只喂五项 → 新门落地会一次性打红 **8 处 `businessPass === true`**。**必须同步改该助手**（补一份合法抽检账本入参），并在 Answer 里写明「这是新门的必然结果，不是测试写错」。
- **记债**：无库内可查账（不进 `eval_runs` 列）· 无 admin 登记控件（本机无浏览器）· 真人抽检动作本身须人。

### 二、校准打分器 → **落**（来源三态 + 规模门 + 只认 live），真 Gateway 打分器**分两段评估**

- **来源判别同构做法**：照仓库既有范式 `*_MODE` 枚举 + 报告三态字符串 + 判定只认最高态（先例：`RETRIEVE_ES_MODE` → `resolveEvalMode`；`INGEST_CONTEXTUALIZE_MODE` + `contextSource` 的「声明 + 实测回退」两层）。
- **三态**：新增环境变量 `JUDGE_CALIB_SCORER`，取值 `off`（**默认** = 缺测）／ `mock` ／ `http`；报告新增 `judgeAurocSource: 'live' | 'mock' | 'none'`。**判定只认 `live`**：`mock` 与 `none` 一律不放行 AUROC 门（PRD §6.1 / ADR-061：mock 数字禁进签字包）。新增 env 的**默认值不改变任何既有默认开关**，不违「不改仓库默认开关」。
- **mock 的 AUROC 值打印**：**打印但带来源标记**（调试需要），判定侧不看来源以外的分支。测例钉死「`mock` 来源绝不能使 `businessPass` 为真」。
- **规模门**：**落**。PRD §4 写死「规模 ≥100 条」，规模不足 → 不放行，reason code `judge_auroc_calib_too_small`（与 `judge_auroc_missing_or_below_min` 可分辨）。这不是空转闸：门槛是**数据**（补足 ≥100 条真标注 + 接 live 打分器即可变绿），且已有 `judgeAurocScored` 计数可承载「实测了多少条」。
- **`http` 真打分器的第二段**：先查 Gateway 侧 `purpose: judge` 的 go/no-go 是否齐备；**齐** → 按既有注入式可测写法实现（测试注入假 gateway 客户端）；**不齐** → 只保留「三态声明 + 判定只认 live」，把「真打分器实现」记债并在 Answer 写明缺哪一环。**禁止**为了让门变绿而让 mock 冒充 live。
- **同构纪律**：两条入口的条件判定形态今天**本就不同**（api 有默认校准集路径、worker 要求两入参同时给），本票必须让**来源判别**在两侧同构；`evaluateAdr046Bind` 仍只由 api 侧调用（研究票 ⑨），不硬造 worker 判定点。

### 三、§8 可复现字段 → **落 L1 侧**，三条哈希 + 可取值，其余**记债**

- **落（能取到就进报告）**：`models`（env + KB `model_bindings`）· `retrieveK` · `rerankTopN` · `tauClaim` · `contextMode`（KB/文档分片参数）· `题面 ID 哈希` · `校准集哈希`（对文件内容算 sha256，复用 `createHash('sha256')` 既有用法）。
- **既有 `mode` 不动**：今天 `L1Report.mode` 是 `retrieve_mode` 的历史别名，**不是** ask 档位。本图**不改它的含义**（改了就是改语义）；§8 的 `mode` 与 `contextMode` 语义歧义**记债**（须 PRD 澄清「mode」指运行档还是运行模式）。
- **不发明版本号**：`fallbackChains 版本` / `promptVersions` / `lifecycle 过滤规则版本` / `session 策略版本` 在本仓**没有版本载体**；**不**对源码文本算哈希顶替（会随任意重构噪声跳变，形似而非 PRD 语义）→ 一律 `null` + 记债（销账 = 引入版本常量载体，或 PRD 明确「版本」的载体）。
- **`seed` / `crag*` 记债**：仓库无随机种子载体；`crag*` 功能未实现。
- **`null` 不许填占位串**：取不到的一律 `null`，报告 md 渲染为「—」。
- **L2 侧（`L2 剧本集哈希` / session 策略版本）留给下一张图**（L2 采集面与零容忍是那张图的主体），本图记债 + 指针。
- **落库同构（研究票反直觉发现 ①）**：api CLI 是 `reportJson: report` 整对象直落，worker `persist.ts` 是**逐键白名单** → 只在报告类型上加字段会被 worker **静默丢弃**。本票必须同步白名单，并加一条钉住两侧同构的测例。
- **docs-guard 纪律**：凡源码文本含 `gold.yaml` 的文件，写文件 API 的 **±200 字符窗内不得再出现 `gold.yaml`** —— 「读 gold.yaml → 算题面哈希 → 写报告」的代码要刻意隔开。
- **契约纪律**：`EvalRunSchema` 是 `.strict()`，新字段必须同步 schema 与 `toEvalRunDto`（`extraStatsFromReport` 今天只透出 `judgeAuroc`），否则 `EvalRunListResponseSchema.parse` 直接抛错。

### 四、统一纪律

- **只加严或逐位等价**：三票各自给出「旧口径为真的情形集合 ⊇ 新口径为真的情形集合」的逐项自证；**唯一**被改写期望值的既有断言是 `adr046-hard-gates.test.ts` 的助手及其 8 处 `businessPass` 断言（新门必然结果），改写理由写进各票 Answer。
- **迁移**：本图裁定**不新增迁移**（抽检走文件账本）→ 无 snapshot parity 风险。若实现中发现非建表不可，必须**不写 DEFAULT** 并回告主控。
- **门禁**：每票 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`（无并发）与 `pnpm check:module-status`（`1-路径`/`6-联动`/`7-时效` 须空）。
- **回写清单**（票 06 执行）：`docs/module-status/api.md` · `worker.md` · `contracts.md` · 能力矩阵「观测 / 评测」行若措辞变 · `docs/testing/coverage/03-ops.md` + `coverage.md`（C3 等行）· `.trellis/spec/api/backend/l1-eval.md` 三节（抽检账本 / 打分器来源三态 / §8 区块）· 总 backlog B10-followup 签字余量行。

### 五、明确不做

- L2 侧采集面（`evidence_snapshot.docId`）与四项零容忍判据 → **下一张图**。
- 真 judge live 跑数 · ≥100 条真标注校准集 · 真人抽检 · 人签。
- `§6.0` 运行时从签字包加载 τ（撞 ADR-007，须 ADR → 改 PRD → 升版）。
- 改 `prds/00–11`、改任何门限数字、改仓库默认开关。
- admin / web 视觉与交互改动（本机无浏览器验证手段）。
- 新增 HTTP 端点（无生产者）。

