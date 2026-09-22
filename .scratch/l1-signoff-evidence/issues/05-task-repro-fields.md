# 落 §8 可复现字段进 L1/L2 报告

Type: task
Status: open
Blocked by: 02

## Question

按裁定票 02 的决定，把 PRD §8 的可复现字段（seed、models、fallbackChains 版本、retrieveK、rerankTopN、tauClaim、crag\*、contextMode、mode、promptVersions、题面 ID 哈希、校准集哈希、lifecycle 过滤规则版本、session 策略版本 / rewrite prompt 版本、L2 剧本集哈希）落到**能取到的都进报告**、**取不到的记债**：

- 报告里新增一个可复现区块（形状以裁定为准），字段值一律从既有来源取，**不编造**：取不到的一律 `null` + 记债行，不许填占位串。
- 三个哈希（题面 ID / 校准集 / L2 剧本集）按裁定实现为**稳定**纯函数：同一输入跨机器同值；同输入两次 run 同值；输入变一个字节值就变。
- 若裁定 L2 侧同批：两条 L2 入口（api CLI 与 worker batch）同样同构落地。
- 新增测例覆盖：哈希稳定性（同值 / 变值）· 取不到的字段为 `null` 而非伪值 · 报告 md 渲染不炸 · 两条入口同构。
- 每处改动配**反证**：改回旧口径（不写字段 / 伪值）→ 测例必红；贴出红。

## 交付

- 源码 + 测例（登记 `tests/index.md`，文件头中文四段）。
- Answer 里给：§8 十四类字段的**逐条去向表**（进报告 / 记债 + 为什么取不到）· 改动文件清单 · 新增用例数 · 反证轮次与红条数 · **未做**清单。
- **不要**提交（commit 由主控做）。
