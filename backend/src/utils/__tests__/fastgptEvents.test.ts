import {
  getNormalizedEventKey,
  isChatIdEvent,
  isChunkLikeEvent,
  isDatasetEvent,
  isEndEvent,
  isInteractiveEvent,
  isReasoningEvent,
  isStatusEvent,
  isSummaryEvent,
  isToolEvent,
  isUsageEvent,
} from '../fastgptEvents';

describe('fastgptEvents pattern matching', () => {
  it('identifies reasoning-related aliases', () => {
    expect(isReasoningEvent('reasoning_content')).toBe(true);
    expect(isReasoningEvent('Chain-Of-Thought')).toBe(true);
    expect(isReasoningEvent('analysis.step')).toBe(true);
    expect(isReasoningEvent('reflection')).toBe(false);
  });

  it('detects tool/workflow events with noisy delimiters', () => {
    expect(isToolEvent('tool.call')).toBe(true);
    expect(isToolEvent('workflow::node')).toBe(true);
    expect(isToolEvent('function#search')).toBe(true);
    expect(isToolEvent('dataset_lookup')).toBe(false);
  });

  it('classifies dataset/knowledge events', () => {
    expect(isDatasetEvent('knowledge_base')).toBe(true);
    expect(isDatasetEvent('Quote-1')).toBe(true);
    expect(isDatasetEvent('reference:doc')).toBe(true);
    expect(isDatasetEvent('tool-chain')).toBe(false);
  });

  it('captures summary and ending signals', () => {
    expect(isSummaryEvent('Final_Summary')).toBe(true);
    expect(isEndEvent('flow.end')).toBe(true);
    expect(isEndEvent('complete')).toBe(true);
    expect(isSummaryEvent('analysis')).toBe(false);
  });

  it('flags usage and chunk events', () => {
    expect(isUsageEvent('usage_tokens')).toBe(true);
    expect(isUsageEvent('tokenReport')).toBe(true);
    expect(isChunkLikeEvent('delta#3')).toBe(true);
    expect(isChunkLikeEvent('message.part')).toBe(true);
    expect(isChunkLikeEvent('progress')).toBe(false);
  });

  it('maps status, interactive, and chat-id updates', () => {
    expect(isStatusEvent('flow.status')).toBe(true);
    expect(isStatusEvent('ProgressUpdate')).toBe(true);
    expect(isInteractiveEvent('interactive_form')).toBe(true);
    expect(isInteractiveEvent('user-select')).toBe(true);
    expect(isChatIdEvent('session.id')).toBe(true);
    expect(isChatIdEvent('chat_identifier')).toBe(true);
  });

  it('normalizes event keys by removing separators', () => {
    expect(getNormalizedEventKey('Flow.Status')).toBe('flowstatus');
    expect(getNormalizedEventKey(' Reasoning-Content ')).toBe('reasoningcontent');
    expect(getNormalizedEventKey('tool_call#1')).toBe('toolcall1');
  });
});
