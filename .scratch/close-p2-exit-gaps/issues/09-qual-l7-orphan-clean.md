# QUAL-L7：孤儿清理 job（激活版永不删）

Type: task
Status: open
Blocked by: 03

## Question

剧本 L7：孤儿清理 job —— 清「半写非激活 version」的对象（PG 向量 / mock ES 单边残留）。护栏：**激活版永不删**。触发含周期 + 文档 `failed`。

前图已查明前置：`documents.index_version` 在 chunk 段就 `+1`，reindex 失败后它指向失败版本，而上一个可检索版本的数据仍在 → 「当前激活 version」不可断言，硬做会误删。**本票在 [裁定文档「当前激活 version」表示](./03-dec-active-version.md) 落定后实现。**

要做的：

1. 按 03 的决定读写「当前激活 version」。
2. 清理 job 本体：识别「单边有向量或 ES」且**非激活** 的残留，幂等、可重入。
3. 周期触发若依赖尚不存在的调度基建，**明说留待**，只落可手工 / 可入队的一次性路径。
4. 失败不得「抬 version」、不得误删激活版。

补测必须包含**反例**：「激活版不被删」；以及「reindex 失败后上一版仍可检索」不被清理破坏。

## Answer

<!-- 解析时写 -->
