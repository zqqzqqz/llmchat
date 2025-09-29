import { FastGPTEvent } from '@/types';
import { getNormalizedEventKey, isReasoningEvent, isChunkLikeEvent } from './fastgptEvents';

const datasetSummary = (payload: any): string | undefined => {
  const dataSource = payload?.data ?? payload?.list ?? payload;
  const items: any[] = Array.isArray(dataSource)
    ? dataSource
    : Array.isArray(payload?.records)
      ? payload.records
      : Array.isArray(payload?.citations)
        ? payload.citations
        : [];

  if (items.length === 0 && typeof payload === 'string') {
    return payload.slice(0, 80);
  }

  const titles = items
    .map((item) => item?.title || item?.name || item?.source || item?.datasetName)
    .filter((title) => typeof title === 'string' && title.trim().length > 0)
    .slice(0, 3);

  if (titles.length > 0) {
    const joined = titles.join('、');
    return `引用：${joined}${items.length > titles.length ? ` 等 ${items.length} 条` : ''}`;
  }

  return items.length > 0 ? `引用 ${items.length} 条知识库内容` : undefined;
};

const summarySummary = (payload: any): string | undefined => {
  const candidate = payload?.content
    ?? payload?.summary
    ?? payload?.text
    ?? payload?.message
    ?? payload?.result;

  if (typeof candidate === 'string') {
    return candidate.trim().slice(0, 120);
  }

  return undefined;
};

const toolSummary = (payload: any): string | undefined => {
  const name = payload?.toolName || payload?.name || payload?.pluginName;
  const action = payload?.action || payload?.method || payload?.type;
  const description = payload?.description || payload?.result || payload?.output || payload?.message;

  const parts = [
    typeof name === 'string' ? name : null,
    typeof action === 'string' ? action : null,
  ].filter(Boolean) as string[];

  const head = parts.join(' · ');
  if (head && typeof description === 'string') {
    return `${head}：${description.slice(0, 80)}`;
  }

  if (head) return head;
  if (typeof description === 'string') {
    return description.slice(0, 80);
  }

  return undefined;
};

const usageSummary = (payload: any): string | undefined => {
  const usage = payload?.usage || payload;
  const prompt = usage?.prompt_tokens ?? usage?.promptTokens;
  const completion = usage?.completion_tokens ?? usage?.completionTokens;
  const total = usage?.total_tokens ?? usage?.totalTokens;

  const parts: string[] = [];
  if (typeof prompt === 'number') parts.push(`提示 ${prompt}`);
  if (typeof completion === 'number') parts.push(`生成 ${completion}`);
  if (typeof total === 'number') parts.push(`总计 ${total}`);

  if (parts.length > 0) {
    return `Token 用量：${parts.join(' / ')}`;
  }

  return undefined;
};

const fallbackSummary = (payload: any): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : undefined;
  }

  const candidate = payload?.content
    ?? payload?.text
    ?? payload?.message
    ?? payload?.detail
    ?? payload?.description;

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : undefined;
  }

  if (typeof payload === 'object' && payload) {
    try {
      const json = JSON.stringify(payload);
      return json.length > 0 ? json.slice(0, 120) : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const EVENT_METADATA_ENTRIES: Array<[string, { label: string; level: FastGPTEvent['level']; summary?: (payload: any) => string | undefined }]> = [
  ['datasetQuote', { label: '知识库引用', level: 'info', summary: datasetSummary }],
  ['datasetCite', { label: '知识库引用', level: 'info', summary: datasetSummary }],
  ['dataset', { label: '知识库引用', level: 'info', summary: datasetSummary }],
  ['quote', { label: '引用内容', level: 'info', summary: datasetSummary }],
  ['citation', { label: '引用内容', level: 'info', summary: datasetSummary }],
  ['citations', { label: '引用内容', level: 'info', summary: datasetSummary }],
  ['references', { label: '参考资料', level: 'info', summary: datasetSummary }],
  ['reference', { label: '参考资料', level: 'info', summary: datasetSummary }],
  ['answer_summary', { label: '答案总结', level: 'success', summary: summarySummary }],
  ['summary', { label: '总结', level: 'success', summary: summarySummary }],
  ['final_summary', { label: '最终总结', level: 'success', summary: summarySummary }],
  ['tool', { label: '工具调用', level: 'info', summary: toolSummary }],
  ['tool_call', { label: '工具调用', level: 'info', summary: toolSummary }],
  ['tool_end', { label: '工具结束', level: 'success', summary: toolSummary }],
  ['toolResult', { label: '工具结果', level: 'success', summary: toolSummary }],
  ['tool_result', { label: '工具结果', level: 'success', summary: toolSummary }],
  ['plugin_call', { label: '插件调用', level: 'info', summary: toolSummary }],
  ['usage', { label: 'Token 用量', level: 'info', summary: usageSummary }],
  ['flowResponses', { label: '流程执行完成', level: 'success', summary: summarySummary }],
];

const EVENT_METADATA: Record<string, { label: string; level: FastGPTEvent['level']; summary?: (payload: any) => string | undefined }> =
  EVENT_METADATA_ENTRIES.reduce((acc, [name, meta]) => {
    acc[getNormalizedEventKey(name)] = meta;
    return acc;
  }, {} as Record<string, { label: string; level: FastGPTEvent['level']; summary?: (payload: any) => string | undefined }>);

const IGNORED_EVENTS = new Set(
  [
    'chunk',
    'message',
    'answer',
    'status',
    'flowNodeStatus',
    'interactive',
    'chatId',
  ]
    .map((name) => getNormalizedEventKey(name))
    .concat(getNormalizedEventKey('reasoning'))
);

const generateEventId = (key: string) => `${key}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const normalizeFastGPTEvent = (eventName: string, payload: any): FastGPTEvent | null => {
  if (!eventName) return null;
  const key = getNormalizedEventKey(eventName);

  if (IGNORED_EVENTS.has(key) || isReasoningEvent(eventName) || isChunkLikeEvent(eventName)) {
    return null;
  }

  const metadata = EVENT_METADATA[key];
  const label = metadata?.label ?? `事件：${eventName}`;
  const level = metadata?.level ?? 'info';
  const summary = metadata?.summary?.(payload) ?? fallbackSummary(payload);

  if (!metadata && !summary) {
    // 未知事件且无法提取摘要时不冗余展示
    return null;
  }

  return {
    id: generateEventId(key || 'event'),
    name: eventName,
    label,
    summary: summary ?? undefined,
    detail: typeof payload === 'string' ? payload : undefined,
    level,
    payload,
    timestamp: Date.now(),
  };
};

export default normalizeFastGPTEvent;
