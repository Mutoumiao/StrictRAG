# 裁定文档「当前激活 version」表示

Type: grilling
Status: open
Blocked by: 02

## Question

「当前激活 version」表示未冻，**同时挡住两处自动化**：孤儿清理（剧本 L7）与文档 ACL 收紧自动 reindex（前图 106 只做了外显 `reindexRequired` + 无泄漏证明）。

今天的死结：`documents.index_version` 在 chunk 段就 `+1`，reindex 失败后它指向**失败版本**，而上一个可检索版本的数据仍在索引里 → 没有可信的「当前激活 version」可断言，硬做孤儿清理会**误删仍在服务的版本**。

请裁定表示落点与语义，逐项回答：

1. **落点**：加列（如 `active_index_version`）/ 加表 / 由 `status=ready` 快照派生 —— 选哪个，为什么；其余方案为何不选。
2. **迁移代价**：是否需要新 migration（本仓手写 SQL + 手写 journal 条目，`db:generate` 不可用），存量行怎么回填。
3. **写入时机**：谁在哪个阶段边界写它；reindex 失败、孤儿清理、删除与 purge 各自如何读它。
4. **一致性**：与 `chunks.index_version`、mock ES 侧 `index_version` 的对账口径；「单边有向量或 ES」的孤儿定义在有了激活表示后如何精确化。
5. **护栏**：写出「激活版永不删」的可测断言形状（反例优先）。
6. **明确留待**：哪些部分依赖尚未存在的基建（例如周期调度），本图不承诺。

答案须落到**可直接编码的精度**（列名 / 写入点 / 读取点 / 失败与回滚行为）。

## Answer

<!-- 解析时写 -->
