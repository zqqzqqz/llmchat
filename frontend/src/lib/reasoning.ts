import { ReasoningStepUpdate } from '@/types';

export interface RawReasoningEvent {
  event?: string;
  data: any;
}

export interface ParsedReasoningUpdate {
  steps: ReasoningStepUpdate[];
  finished?: boolean;
  totalSteps?: number;
}

const STEP_TITLE_REGEX = /^(?:步骤\s*\d+|Step\s*\d+|思考\s*\d+|阶段\s*\d+|环节\s*\d+|Task\s*\d+|第[\d一二三四五六七八九十百零两]+步|\d+[\.、）])/i;

export const normalizeReasoningDisplay = (
  input: string
): { body: string; title?: string } => {
  const sanitized = (input ?? '').replace(/\r\n/g, '\n').trim();
  if (!sanitized) {
    return { body: '' };
  }

  const lines = sanitized.split(/\n+/);
  const firstLine = lines[0]?.trim() ?? '';
  const restLines = lines.slice(1);

  let candidateTitle: string | null = null;
  let inlineRemainder = '';
  let matchedByPattern = false;

  const colonMatch = firstLine.match(/^(?<title>.+?)[：:]\s*(?<rest>.*)$/);
  if (colonMatch?.groups?.title) {
    candidateTitle = colonMatch.groups.title.trim();
    inlineRemainder = colonMatch.groups.rest.trim();
  } else {
    const patternMatch = firstLine.match(STEP_TITLE_REGEX);
    if (patternMatch) {
      candidateTitle = patternMatch[0].trim();
      inlineRemainder = firstLine.slice(patternMatch[0].length).trim();
      matchedByPattern = true;
    }
  }

  const restJoined = restLines.join('\n').trim();

  if (!candidateTitle) {
    return { body: sanitized };
  }

  const normalizedTitle = candidateTitle.replace(/\s+/g, ' ').trim();
  const effectiveRest = [inlineRemainder, restJoined]
    .filter((segment) => segment && segment.length > 0)
    .join('\n')
    .trim();

  const isShortTitle = normalizedTitle.length > 0 && normalizedTitle.length <= 24;
  const shouldUseTitle =
    (matchedByPattern && (effectiveRest.length > 0 || inlineRemainder.length > 0 || restJoined.length > 0)) ||
    (!matchedByPattern && colonMatch != null && isShortTitle && effectiveRest.length > 0);

  if (!shouldUseTitle) {
    return { body: sanitized };
  }

  const body = effectiveRest || sanitized;

  return {
    body,
    title: normalizedTitle,
  };
};

const tryParseJson = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const firstNumber = (candidates: Array<unknown>): number | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const mergeTotalSteps = (current: number | undefined, next: number | undefined, fallback: () => number | undefined) => {
  if (typeof next === 'number' && Number.isFinite(next)) {
    return next;
  }
  if (typeof current === 'number') {
    return current;
  }
  return fallback();
};

export const parseReasoningPayload = (payload: RawReasoningEvent | undefined | null): ParsedReasoningUpdate | null => {
  if (!payload || payload.data == null) return null;

  const queue: any[] = [payload.data];
  const steps: ReasoningStepUpdate[] = [];
  let finished = false;
  let totalSteps: number | undefined;

  const pushStep = (step: ReasoningStepUpdate) => {
    const normalized = normalizeText(step.content);
    if (!normalized) return;

    const mergedStep: ReasoningStepUpdate = {
      ...step,
      content: normalized,
    };

    steps.push(mergedStep);

    if (typeof mergedStep.totalSteps === 'number' && Number.isFinite(mergedStep.totalSteps)) {
      totalSteps = Math.max(totalSteps ?? 0, mergedStep.totalSteps);
    }
  };

  while (queue.length > 0) {
    const item = queue.shift();
    if (item == null) continue;

    if (typeof item === 'string') {
      const parsed = tryParseJson(item);
      if (parsed) {
        queue.push(parsed);
        continue;
      }
      pushStep({ content: item });
      continue;
    }

    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }

    if (typeof item === 'object') {
      // 嵌套的常见字段
      if (item.data && item !== item.data) queue.push(item.data);
      if (item.payload && item !== item.payload) queue.push(item.payload);
      if (item.output?.reasoning_content) queue.push(item.output.reasoning_content);
      if (item.delta?.reasoning_content) queue.push(item.delta.reasoning_content);
      if (item.reasoning_content) queue.push(item.reasoning_content);
      if (item.reasoning) queue.push(item.reasoning);
      if (item.steps) queue.push(item.steps);

      // thought / analysis 信息
      const textFromTextField = normalizeText((item as any).text);
      if (textFromTextField) {
        const parsed = tryParseJson(textFromTextField);
        if (parsed) {
          queue.push(parsed);
        }

        const orderFromText = firstNumber([
          (item as any).thoughtNumber,
          (item as any).step,
          (item as any).index,
          (item as any).order,
          (item as any).stepNumber,
        ]);

        const totalFromText = firstNumber([
          (item as any).totalThoughts,
          (item as any).total_steps,
          (item as any).totalSteps,
        ]);

        pushStep({
          content: textFromTextField,
          order: orderFromText,
          totalSteps: totalFromText,
          raw: item,
        });
      }

      const candidate = normalizeText(
        (item as any).thought ??
        (item as any).content ??
        (item as any).message ??
        (item as any).analysis ??
        (item as any).reasoning ??
        (item as any).details
      );

      if (candidate) {
        const order = firstNumber([
          (item as any).order,
          (item as any).step,
          (item as any).stepIndex,
          (item as any).index,
          (item as any).thoughtNumber,
        ]);

        const total = firstNumber([
          (item as any).totalThoughts,
          (item as any).totalSteps,
          (item as any).total_steps,
        ]);

        const title = normalizeText((item as any).title) ?? undefined;

        pushStep({
          content: candidate,
          order,
          totalSteps: total,
          title,
          raw: item,
        });
      }

      const totalCandidate = firstNumber([
        (item as any).totalThoughts,
        (item as any).totalSteps,
        (item as any).total_steps,
      ]);
      if (typeof totalCandidate === 'number' && Number.isFinite(totalCandidate)) {
        totalSteps = Math.max(totalSteps ?? 0, totalCandidate);
      }

      if (
        (item as any).nextThoughtNeeded === false ||
        (item as any).need_next_thought === false ||
        (item as any).hasMore === false ||
        (item as any).has_more === false ||
        (item as any).finished === true ||
        (item as any).is_final === true ||
        (item as any).isFinal === true ||
        (item as any).done === true ||
        (item as any).completed === true
      ) {
        finished = true;
      }
    }
  }

  if (!finished && payload.event && /end|finish|complete|done/i.test(payload.event)) {
    finished = true;
  }

  if (steps.length === 0 && !finished) {
    return null;
  }

  totalSteps = mergeTotalSteps(totalSteps, undefined, () => {
    const maxOrder = steps.reduce((max, step) => {
      if (typeof step.order === 'number' && Number.isFinite(step.order)) {
        return Math.max(max, step.order);
      }
      return max;
    }, 0);
    return maxOrder > 0 ? maxOrder : undefined;
  });

  return {
    steps,
    finished,
    totalSteps,
  };
};

export default parseReasoningPayload;
