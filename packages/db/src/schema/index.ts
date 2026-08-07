export { baseColumns } from './_shard/base-columns.js';
export { schemaMeta } from './system/schema-meta.js';
export { users } from './system/users.js';
export { platformRoles, userRoles } from './system/platform-roles.js';
export { departments, userDepartments } from './system/departments.js';

export { modelProviders, type ModelProviderModelRow } from './system/model-providers.js';
export { modelBindings } from './system/model-bindings.js';
export { knowledgeBases } from './kb/knowledge-bases.js';
export { documents } from './kb/documents.js';
export { chunks } from './kb/chunks.js';
export { chunkManifests } from './kb/chunk-manifests.js';
export { chunkEmbeddings } from './kb/chunk-embeddings.js';
export { ingestJobs } from './kb/ingest-jobs.js';
export { kbMembers } from './kb/kb-members.js';
export { askSessions } from './ask/ask-sessions.js';
export { askTraces } from './ask/ask-traces.js';
export type { EvidenceSnapshotItem } from './ask/ask-traces.js';
export { askFeedback } from './ask/ask-feedback.js';
