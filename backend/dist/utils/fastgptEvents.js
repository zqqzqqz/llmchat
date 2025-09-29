"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNormalizedEventKey = exports.isChunkLikeEvent = exports.isChatIdEvent = exports.isInteractiveEvent = exports.isStatusEvent = exports.isEndEvent = exports.isUsageEvent = exports.isToolEvent = exports.isSummaryEvent = exports.isDatasetEvent = exports.isReasoningEvent = void 0;
const normalizeEventKey = (name) => name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const buildPatternMatcher = (patterns) => {
    const normalizedPatterns = patterns.map((pattern) => typeof pattern === 'string'
        ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : pattern);
    return (eventName) => {
        if (!eventName)
            return false;
        const normalized = normalizeEventKey(eventName);
        return normalizedPatterns.some((pattern) => pattern.test(normalized));
    };
};
exports.isReasoningEvent = buildPatternMatcher([
    /reason/,
    /thought/,
    /analysis/,
    /think/,
    /chainofthought/,
]);
exports.isDatasetEvent = buildPatternMatcher([
    /dataset/,
    /quote/,
    /cite/,
    /reference/,
    /knowledge/,
]);
exports.isSummaryEvent = buildPatternMatcher([
    /summary/,
    /finalsummary/,
    /conclusion/,
    /result/,
]);
exports.isToolEvent = buildPatternMatcher([
    /tool/,
    /plugin/,
    /function/,
    /search/,
    /workflow/,
]);
exports.isUsageEvent = buildPatternMatcher([
    /usage/,
    /token/,
]);
exports.isEndEvent = buildPatternMatcher([
    /end/,
    /finish/,
    /complete/,
    /done/,
]);
exports.isStatusEvent = buildPatternMatcher([
    /status/,
    /flownodestatus/,
    /progress/,
]);
exports.isInteractiveEvent = buildPatternMatcher([
    /interactive/,
    /form/,
    /select/,
]);
exports.isChatIdEvent = buildPatternMatcher([
    /chatid/,
    /session/,
]);
exports.isChunkLikeEvent = buildPatternMatcher([
    /chunk/,
    /message/,
    /delta/,
]);
exports.getNormalizedEventKey = normalizeEventKey;
//# sourceMappingURL=fastgptEvents.js.map