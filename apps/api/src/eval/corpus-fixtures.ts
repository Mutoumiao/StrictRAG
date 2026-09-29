/**
 * 评测语料夹具的读取面（入库 CLI 与跑批 CLI 共用）。
 *
 * 实现已上移到 `@strict-rag/contracts/eval-corpus-ledger-file`（api 与 worker 两侧共用同一份，
 * worker 无法 import 本仓 api 专属相对路径）；本文件仅保留原导出名，api 侧 import 路径一个字不变。
 *
 * 逻辑 id ↔ 文件的绑定**从目录结构派生**（`fixtures/ingest-samples/<name>` → `ingest-samples/<name>`，
 * `fixtures/l2/corpus/<name>` → `l2-corpus/<name>`），禁止在脚本里再手抄一份清单（手抄会漂）；
 * 权威对照仍是两份 fixtures README 的表格（`fixtures/l1` 与 `fixtures/l2`），由对账测例机械核对。
 *
 * 只做 I/O（读文件字节 + sha256）与派生；账本形状 / 指纹纯函数在 `@strict-rag/contracts/eval-corpus-ledger`。
 */
export {
  FIXTURE_CORPUS_DIRS,
  deriveLogicalId,
  defaultRepoRoot,
  readFixtureCorpus,
  fixtureCorpusFingerprint,
  type FixtureCorpusFile,
} from '@strict-rag/contracts/eval-corpus-ledger-file';
