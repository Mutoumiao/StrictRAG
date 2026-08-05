import type { AskMode, RouteLabel } from './state.js';

export type RouteDecision = {
  routeLabel: RouteLabel;
  route_source: 'rule' | 'fallback_single';
  route_llm_conf: number | null;
  route_post_block: boolean;
  route_llm_skipped: boolean;
};

/** 寒暄白名单（整句归一后精确/前缀） */
const CHITCHAT_EXACT = new Set([
  '你好',
  '您好',
  'hello',
  'hi',
  'hey',
  '早上好',
  '下午好',
  '晚上好',
  '谢谢',
  '多谢',
  'thanks',
  'thank you',
  '再见',
  '拜拜',
  'bye',
]);

/** 后置禁词：命中则禁止 chitchat，强制 single（制度/数字/文号等） */
const POST_BLOCK =
  /政策|制度|规定|条例|办法|流程|报销|请假|年假|病假|合同|条款|文号|〔|〕|第\s*\d+\s*条|\d{2,}|\?|？|多少|如何|怎样|是否|能否|什么|哪里|哪个|谁|何时|为什么|怎么/;

/** 知识向线索（疑问/制度词）→ single */
const KNOWLEDGE_HINT =
  /政策|制度|规定|条例|办法|流程|报销|请假|年假|病假|合同|条款|文号|多少|如何|怎样|是否|能否|什么|哪里|哪个|谁|何时|为什么|怎么|\?|？/;

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/[!！。.~～]+$/g, '');
}

/**
 * 纯规则 route（P2 ponytail 主路径）。
 * fast：永不 LLM；balanced/strict 未命中 → fallback_single（不默认 chitchat）。
 * multi_hop 标签忽略 → single。
 */
export function ruleRoute(question: string, mode: AskMode = 'balanced'): RouteDecision {
  void mode; // P2 纯规则；balanced/strict LLM route → backlog
  const n = normalize(question);
  if (!n) {
    return {
      routeLabel: 'single',
      route_source: 'fallback_single',
      route_llm_conf: null,
      route_post_block: false,
      route_llm_skipped: true,
    };
  }

  const looksChitchat =
    CHITCHAT_EXACT.has(n) ||
    /^(你好|您好|hello|hi|hey)[\s,，!！.。]*$/.test(n) ||
    n.length <= 4 && /^(哈+|嗯+|哦+|嘿+)$/.test(n);

  if (looksChitchat) {
    const blocked = POST_BLOCK.test(question);
    if (blocked) {
      return {
        routeLabel: 'single',
        route_source: 'rule',
        route_llm_conf: null,
        route_post_block: true,
        route_llm_skipped: true,
      };
    }
    return {
      routeLabel: 'chitchat',
      route_source: 'rule',
      route_llm_conf: null,
      route_post_block: false,
      route_llm_skipped: true,
    };
  }

  if (KNOWLEDGE_HINT.test(question) || n.length > 4) {
    return {
      routeLabel: 'single',
      route_source: 'rule',
      route_llm_conf: null,
      route_post_block: false,
      route_llm_skipped: true,
    };
  }

  // 模糊短句：不猜 chitchat → single
  return {
    routeLabel: 'single',
    route_source: 'fallback_single',
    route_llm_conf: null,
    route_post_block: false,
    route_llm_skipped: true,
  };
}
