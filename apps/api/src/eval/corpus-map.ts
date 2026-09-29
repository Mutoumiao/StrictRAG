/**
 * 跑批侧读账本 + 新鲜度校验（工单 02 裁定 3 / 4）。
 *
 * 实现已上移到 `@strict-rag/contracts/eval-corpus-ledger-file`（api 与 worker 两侧共用同一份）；
 * 本文件仅保留原导出名，api 侧 import 路径一个字不变。
 *
 * 只认账本里的精确 uuid；账本 `kbId` 或 `corpusFingerprint` 与本次 run / 当前夹具不符 → 拒跑（exit 2）。
 * 「docId 是否仍在库内」**不做**运行时校验（会让 eval CLI 引入新的 DB 读，扩大回归面）—— 改由
 * 账本记 `title` + `GET …/documents` 全量人工对账（裁定 4，显式划出）。
 */
export {
  CorpusLedgerError,
  loadCorpusLedgerFile,
  resolveCorpusLedgerForRun,
} from '@strict-rag/contracts/eval-corpus-ledger-file';
