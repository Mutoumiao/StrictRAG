import type { AskReason } from '@strict-rag/contracts';

/** PRD §3 默认 userMessage + suggestedActions（zh-CN） */
export function reasonPresentation(reason: AskReason): {
  userMessage: string;
  suggestedActions: { type: string; label: string }[];
} {
  switch (reason) {
    case 'verified':
      return { userMessage: '', suggestedActions: [{ type: 'view_citations', label: '查看引用' }] };
    case 'chitchat':
      return {
        userMessage: '',
        suggestedActions: [{ type: 'ask_knowledge', label: '提问知识库内容' }],
      };
    case 'model_abstained':
      return {
        userMessage: '证据不足，无法可靠回答。',
        suggestedActions: [
          { type: 'rephrase', label: '换种问法' },
          { type: 'feedback_missing_doc', label: '反馈缺文档' },
        ],
      };
    case 'low_retrieval':
      return {
        userMessage: '未找到足够相关资料。',
        suggestedActions: [
          { type: 'rephrase', label: '换种问法' },
          { type: 'contact_admin', label: '联系管理员' },
        ],
      };
    case 'invalid_citations':
      return {
        userMessage: '无法生成可追溯的回答。',
        suggestedActions: [{ type: 'rephrase', label: '换种问法' }],
      };
    case 'unsupported_claims':
      return {
        userMessage: '生成内容未能通过证据校验，已拒绝作答。',
        suggestedActions: [
          { type: 'rephrase', label: '换种问法' },
          { type: 'feedback', label: '反馈' },
        ],
      };
    case 'kb_not_ready':
      return {
        userMessage: '知识库尚无可用文档，请稍后再试或联系管理员。',
        suggestedActions: [{ type: 'contact_admin', label: '联系管理员' }],
      };
    case 'budget_exhausted':
      return {
        userMessage: '本次问答步骤较多，暂无法在可靠约束下完成，请简化问题后重试。',
        suggestedActions: [{ type: 'rephrase', label: '简化问题后重试' }],
      };
    case 'rerank_unavailable':
      return {
        userMessage: '检索精排服务暂不可用，为避免不准确回答已停止作答。',
        suggestedActions: [{ type: 'retry_later', label: '稍后重试' }],
      };
    case 'claim_split_failed':
      return {
        userMessage: '无法完成答案校验准备，已拒绝作答。',
        suggestedActions: [
          { type: 'retry_later', label: '稍后重试' },
          { type: 'rephrase', label: '换种问法' },
        ],
      };
    case 'not_member':
      return {
        userMessage: '您无权访问该知识库。',
        suggestedActions: [{ type: 'contact_admin', label: '联系管理员' }],
      };
    case 'max_hops_exceeded':
      return {
        userMessage: '多次检索后仍证据不足。',
        suggestedActions: [{ type: 'feedback_missing_doc', label: '反馈缺文档' }],
      };
    case 'coref_unresolved':
      return {
        userMessage: '未能确定您指的是哪一主题，请用完整问题重述（勿依赖「刚才/那个」）。',
        suggestedActions: [{ type: 'rephrase', label: '用完整问题重述' }],
      };
    case 'acl_filter_too_large':
      return {
        userMessage: '权限过滤范围过大，已拒绝本次检索（未截断）。',
        suggestedActions: [{ type: 'contact_admin', label: '联系管理员' }],
      };
    case 'internal_guard':
    default:
      return {
        userMessage: '服务暂时无法完成可靠回答。',
        suggestedActions: [{ type: 'retry_later', label: '稍后重试' }],
      };
  }
}
