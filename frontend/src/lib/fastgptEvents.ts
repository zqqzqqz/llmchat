const normalizeEventKey = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const buildPatternMatcher = (patterns: Array<string | RegExp>) => {
  const normalizedPatterns = patterns.map((pattern) =>
    typeof pattern === 'string'
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : pattern
  );

  return (eventName: string): boolean => {
    if (!eventName) return false;
    const normalized = normalizeEventKey(eventName);
    return normalizedPatterns.some((pattern) => pattern.test(normalized));
  };
};

export const isReasoningEvent = buildPatternMatcher([
  /reason/,
  /thought/,
  /analysis/,
  /think/,
  /chainofthought/,
]);

export const isDatasetEvent = buildPatternMatcher([
  /dataset/,
  /quote/,
  /cite/,
  /reference/,
  /knowledge/,
]);

export const isSummaryEvent = buildPatternMatcher([
  /summary/,
  /finalsummary/,
  /conclusion/,
  /result/,
]);

export const isToolEvent = buildPatternMatcher([
  /tool/,
  /plugin/,
  /function/,
  /search/,
  /workflow/,
]);

export const isUsageEvent = buildPatternMatcher([
  /usage/,
  /token/,
]);

export const isEndEvent = buildPatternMatcher([
  /end/,
  /finish/,
  /complete/,
  /done/,
]);

export const isStatusEvent = buildPatternMatcher([
  /status/,
  /flownodestatus/,
  /progress/,
]);

export const isInteractiveEvent = buildPatternMatcher([
  /interactive/,
  /form/,
  /select/,
]);

export const isChatIdEvent = buildPatternMatcher([
  /chatid/,
  /session/,
]);

export const isChunkLikeEvent = buildPatternMatcher([
  /chunk/,
  /message/,
  /delta/,
]);

export const getNormalizedEventKey = normalizeEventKey;
