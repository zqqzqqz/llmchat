import { FastGPTEvent } from '@/types';
import { getNormalizedEventKey, isReasoningEvent, isChunkLikeEvent } from './fastgptEvents';

const truncateText = (value: string, max = 80): string => {
  if (typeof value !== 'string' || max <= 0) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
};

const safeJsonParse = <T = any>(input: unknown): T | null => {
  if (typeof input !== 'string') return null;
  const attempts = [input];
  const trimmed = input.trim();
  if (trimmed !== input) attempts.push(trimmed);

  if (trimmed.endsWith(',')) {
    attempts.push(trimmed.slice(0, -1));
  }

  if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
    attempts.push(`${trimmed}}`);
  }

  if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
    attempts.push(`${trimmed}]`);
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      continue;
    }
  }
  return null;
};

interface ToolEventState {
  id: string;
  paramsChunks: string[];
  toolName?: string;
  functionName?: string;
}

const toolEventStates = new Map<string, ToolEventState>();

const getToolState = (toolId: string): ToolEventState => {
  let state = toolEventStates.get(toolId);
  if (!state) {
    state = { id: toolId, paramsChunks: [] };
    toolEventStates.set(toolId, state);
  }
  return state;
};

const TOOL_START_EVENTS = new Set<string>([
  'tool',
  'toolcall',
  'plugincall',
  'plugin',
]);

const TOOL_UPDATE_EVENTS = new Set<string>([
  'toolparams',
]);

const TOOL_COMPLETE_EVENTS = new Set<string>([
  'toolresponse',
  'toolresult',
  'toolend',
  'toolcomplete',
  'toolfinish',
]);

const collectToolParamsInfo = (state: ToolEventState) => {
  if (!state.paramsChunks.length) {
    return {
      raw: undefined as string | undefined,
      parsed: undefined as any,
      summary: undefined as string | undefined,
      detail: undefined as string | undefined,
    };
  }

  const raw = state.paramsChunks.join('').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return { raw: undefined, parsed: undefined, summary: undefined, detail: undefined };
  }

  const parsed = safeJsonParse<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      raw,
      parsed: null,
      summary: truncateText(raw, 60),
      detail: undefined,
    };
  }

  const entries = Object.entries(parsed);
  const primaryEntry = entries.find(([key]) => ['ques', 'query', 'question', 'input', 'prompt', 'keywords', 'text'].includes(key));

  const summaryParts: string[] = [];
  if (primaryEntry && typeof primaryEntry[1] === 'string') {
    summaryParts.push(`查询「${truncateText(primaryEntry[1], 24)}」`);
  }

  const otherEntries = entries.filter(([key]) => key !== (primaryEntry?.[0] ?? ''));
  if (otherEntries.length > 0) {
    const extras = otherEntries
      .map(([key, value]) => `${key}=${truncateText(String(value), 16)}`)
      .join('，');
    if (extras) {
      summaryParts.push(extras);
    }
  }

  const detail = otherEntries.length > 0
    ? otherEntries
        .map(([key, value]) => `${key}：${typeof value === 'string' ? truncateText(value, 40) : truncateText(JSON.stringify(value), 40)}`)
        .join('\n')
    : undefined;

  return {
    raw,
    parsed,
    summary: summaryParts.length > 0 ? summaryParts.join(' ｜ ') : truncateText(raw, 60),
    detail,
  };
};

const extractDatasetFromTextBlocks = (texts: string[]) => {
  for (const text of texts) {
    const parsed = safeJsonParse<any>(text);
    if (!parsed || typeof parsed !== 'object') continue;

    const list = Array.isArray(parsed.data)
      ? parsed.data
      : Array.isArray(parsed.list)
        ? parsed.list
        : Array.isArray(parsed.records)
          ? parsed.records
          : null;

    if (list && Array.isArray(list)) {
      return { items: list, raw: parsed };
    }
  }
  return null;
};

const buildToolResponseInfo = (response: any) => {
  if (!response) {
    return {
      summary: undefined as string | undefined,
      detail: undefined as string | undefined,
      payload: undefined as any,
      isError: false,
    };
  }

  const rawString = typeof response === 'string'
    ? response.replace(/\s+/g, ' ').trim()
    : undefined;

  const parsedResponse = typeof response === 'string'
    ? safeJsonParse<any>(response) ?? response
    : response;

  if (!parsedResponse || typeof parsedResponse !== 'object' || Array.isArray(parsedResponse)) {
    return {
      summary: rawString ? truncateText(rawString, 100) : undefined,
      detail: undefined,
      payload: rawString,
      isError: false,
    };
  }

  if (parsedResponse.isError) {
    return {
      summary: parsedResponse.errorMessage || parsedResponse.message || '工具调用失败',
      detail: parsedResponse?.stack ?? undefined,
      payload: parsedResponse,
      isError: true,
    };
  }

  const textBlocks = Array.isArray(parsedResponse.content)
    ? parsedResponse.content
        .filter((block: any) => block && block.type === 'text' && typeof block.text === 'string')
        .map((block: any) => block.text as string)
    : [];

  const dataset = extractDatasetFromTextBlocks(textBlocks);

  if (dataset) {
    const { items } = dataset;
    const count = items.length;
    const first = items[0] || {};
    const title = first.title || first.name || first.q || first.question || first.productName;
    const source = first.sourceName || first.source || first.datasetName;

    const summaryParts: string[] = [`命中 ${count} 条知识库内容`];
    if (title) summaryParts.push(`示例：${truncateText(String(title), 24)}`);
    if (source) summaryParts.push(`来源：${truncateText(String(source), 24)}`);

    const detail = items.slice(0, 3)
      .map((item: any, index: number) => {
        const itemTitle = item.title || item.name || item.q || item.question || item.productName || '记录';
        const itemSource = item.sourceName || item.source || item.datasetName;
        return `${index + 1}. ${truncateText(String(itemTitle), 40)}${itemSource ? `（${truncateText(String(itemSource), 20)}）` : ''}`;
      })
      .join('\n');

    return {
      summary: summaryParts.join(' · '),
      detail: detail || undefined,
      payload: {
        ...parsedResponse,
        datasetPreview: items.slice(0, 5),
      },
      isError: false,
    };
  }

  if (textBlocks.length > 0) {
    return {
      summary: truncateText(textBlocks[0].replace(/\s+/g, ' ').trim(), 100),
      detail: textBlocks.slice(1, 3).map((item: string) => truncateText(item.replace(/\s+/g, ' ').trim(), 80)).join('\n') || undefined,
      payload: parsedResponse,
      isError: false,
    };
  }

  const fallback = parsedResponse.result || parsedResponse.message || parsedResponse.summary;
  if (typeof fallback === 'string') {
    return {
      summary: truncateText(fallback.replace(/\s+/g, ' ').trim(), 100),
      detail: undefined,
      payload: parsedResponse,
      isError: false,
    };
  }

  return {
    summary: rawString ? truncateText(rawString, 100) : undefined,
    detail: undefined,
    payload: parsedResponse,
    isError: false,
  };
};

const normalizeToolEvent = (eventName: string, normalizedKey: string, payload: any): FastGPTEvent | null => {
  const tool = payload?.tool;
  if (!tool || typeof tool.id !== 'string') {
    return null;
  }

  const toolId = tool.id;
  const state = getToolState(toolId);

  if (typeof tool.toolName === 'string' && tool.toolName.trim()) {
    state.toolName = tool.toolName.trim();
  }

  if (typeof tool.functionName === 'string' && tool.functionName.trim()) {
    state.functionName = tool.functionName.trim();
  }

  if (typeof tool.params === 'string' && tool.params.trim()) {
    state.paramsChunks.push(tool.params);
  }

  const paramsInfo = collectToolParamsInfo(state);

  const labelCandidates = [state.toolName, state.functionName, '工具调用'].filter((value): value is string => !!value && value.trim().length > 0);
  const label = labelCandidates[0] ?? '工具调用';

  const basePayload: Record<string, any> = {
    toolId,
    toolName: state.toolName ?? null,
    functionName: state.functionName ?? null,
    params: paramsInfo.parsed ?? null,
    paramsRaw: paramsInfo.raw ?? null,
  };

  const baseEvent: FastGPTEvent = {
    id: `tool-${toolId}`,
    groupId: `tool-${toolId}`,
    name: eventName,
    label,
    level: 'info',
    summary: paramsInfo.summary ?? '工具调用中',
    detail: paramsInfo.detail,
    payload: basePayload,
    timestamp: Date.now(),
    stage: 'update',
  };

  if (TOOL_START_EVENTS.has(normalizedKey)) {
    baseEvent.stage = 'start';
    baseEvent.summary = paramsInfo.summary ? `调用中 · ${paramsInfo.summary}` : '工具调用中';
    return baseEvent;
  }

  if (TOOL_UPDATE_EVENTS.has(normalizedKey)) {
    if (paramsInfo.summary) {
      baseEvent.summary = `调用中 · ${paramsInfo.summary}`;
    }
    return baseEvent;
  }

  if (TOOL_COMPLETE_EVENTS.has(normalizedKey)) {
    const responseInfo = buildToolResponseInfo(tool.response ?? payload?.response);
    baseEvent.stage = 'complete';
    baseEvent.level = responseInfo.isError ? 'error' : 'success';
    baseEvent.summary = responseInfo.summary ?? (responseInfo.isError ? '工具调用失败' : '工具调用完成');
    baseEvent.detail = responseInfo.detail ?? baseEvent.detail;
    baseEvent.payload = {
      ...basePayload,
      response: responseInfo.payload,
      rawResponsePreview: typeof tool.response === 'string' ? truncateText(tool.response.replace(/\s+/g, ' ').trim(), 400) : undefined,
    };
    toolEventStates.delete(toolId);
    return baseEvent;
  }

  return baseEvent;
};

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
  // 友好映射：工作流耗时/开始/结束
  ['workflowDuration', { label: '工作流耗时', level: 'success', summary: (payload: any) => {
    const seconds = typeof payload === 'number' ? payload : (payload?.durationSeconds ?? payload?.seconds ?? payload?.duration);
    if (typeof seconds === 'number' && isFinite(seconds)) {
      const s = Math.round(seconds * 100) / 100;
      const mins = Math.floor(s / 60);
      const rem = Math.round((s - mins * 60) * 100) / 100;
      return mins > 0 ? `总耗时：${mins}分${rem}秒` : `总耗时：${s}秒`;
    }
    return fallbackSummary(payload);
  } }],
  ['start', { label: '开始', level: 'info', summary: (payload: any) => {
    const id = payload?.id ?? payload?.requestId;
    const agent = payload?.agentId ?? payload?.appId;
    return [id ? `请求ID：${truncateText(String(id), 24)}` : undefined, agent ? `Agent：${truncateText(String(agent), 24)}` : undefined]
      .filter(Boolean)
      .join('，') || fallbackSummary(payload);
  } }],
  ['end', { label: '结束', level: 'success', summary: (payload: any) => fallbackSummary(payload) }],
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
    'start',
    'end',
    'dataset',
    'quote',
    'citation',
    'citations',
    'references',
    'reference',
    'summary',
    'final_summary',
    'answer_summary',
    'usage',
  ]
    .map((name) => getNormalizedEventKey(name))
    .concat(getNormalizedEventKey('reasoning'))
);

const generateEventId = (key: string) => `${key}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const normalizeFastGPTEvent = (eventName: string, payload: any): FastGPTEvent | null => {
  if (!eventName) return null;
  const key = getNormalizedEventKey(eventName);

  const toolEvent = normalizeToolEvent(eventName, key, payload);
  if (toolEvent) {
    return toolEvent;
  }

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
