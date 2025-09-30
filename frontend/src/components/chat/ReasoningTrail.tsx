import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, Loader2, CheckCircle2, Copy, Check } from 'lucide-react';
import { ReasoningStep } from '@/types';

interface ReasoningTrailProps {
  steps: ReasoningStep[];
  totalSteps?: number;
  isStreaming?: boolean;
  finished?: boolean;
}

const COLLAPSE_THRESHOLD = 7;
const COLLAPSE_HEAD_COUNT = 3;
const COLLAPSE_TAIL_COUNT = 2;
const CORE_VIEW = 'core';
const FULL_VIEW = 'full';

const formatStepOrder = (step: ReasoningStep, fallbackIndex: number) => {
  if (typeof step.order === 'number' && Number.isFinite(step.order)) {
    return step.order;
  }
  return fallbackIndex + 1;
};

export const ReasoningTrail: React.FC<ReasoningTrailProps> = ({
  steps,
  totalSteps,
  isStreaming = false,
  finished = false,
}) => {
  const [viewMode, setViewMode] = useState(() =>
    steps.length > COLLAPSE_THRESHOLD ? CORE_VIEW : FULL_VIEW
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setViewMode(steps.length > COLLAPSE_THRESHOLD ? CORE_VIEW : FULL_VIEW);
    setCopied(false);
  }, [steps.length]);

  if (!steps || steps.length === 0) {
    return null;
  }

  const shouldCollapse = steps.length > COLLAPSE_THRESHOLD;
  const collapsed = shouldCollapse && viewMode === CORE_VIEW;
  const annotatedSteps = useMemo(
    () => steps.map((step, index) => ({ step, originalIndex: index })),
    [steps]
  );

  const virtualized = useMemo(() => {
    if (!collapsed) {
      return { items: annotatedSteps, hiddenCount: 0, markerIndex: null as number | null };
    }
    const head = annotatedSteps.slice(0, COLLAPSE_HEAD_COUNT);
    const tailStart = Math.max(head.length, annotatedSteps.length - COLLAPSE_TAIL_COUNT);
    const tail = annotatedSteps.slice(tailStart);
    const combined = [...head, ...tail];
    const hiddenCount = Math.max(annotatedSteps.length - combined.length, 0);
    return { items: combined, hiddenCount, markerIndex: head.length };
  }, [annotatedSteps, collapsed]);

  const effectiveTotal =
    typeof totalSteps === 'number' && Number.isFinite(totalSteps)
      ? totalSteps
      : undefined;
  const displayTotal = effectiveTotal ?? steps.length;
  const progressPercent =
    typeof effectiveTotal === 'number' && effectiveTotal > 0
      ? Math.min(Math.round((Math.min(steps.length, effectiveTotal) / effectiveTotal) * 100), 100)
      : undefined;
  const latestIndex = steps.length - 1;
  const hiddenCount = collapsed
    ? virtualized.hiddenCount
    : Math.max(steps.length - virtualized.items.length, 0);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === CORE_VIEW ? FULL_VIEW : CORE_VIEW));
  }, []);

  const handleCopy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator?.clipboard) return;

    const serialized = steps
      .map((step, index) => {
        const order = formatStepOrder(step, index);
        const title = step.title ? ` ${step.title}` : '';
        const content = step.content ? `\n${step.content}` : '';
        return `步骤 ${order}${title}${content}`.trim();
      })
      .filter(Boolean)
      .join('\n\n');

    if (!serialized) return;

    try {
      await navigator.clipboard.writeText(serialized);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制思维链失败:', error);
    }
  }, [steps]);

  const statusIndicator = isStreaming && !finished ? (
    <>
      <Loader2 className="h-3 w-3 animate-spin text-brand" />
      <span>思考中...</span>
    </>
  ) : (
    <>
      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      <span>{finished ? '思考完成' : '思考更新'}</span>
    </>
  );

  return (
    <div className="mb-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          思维链
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {shouldCollapse && (
            <button
              type="button"
              onClick={toggleViewMode}
              className="flex items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
            >
              {viewMode === CORE_VIEW ? '查看完整思维链' : '仅看关键步骤'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            disabled={steps.length === 0}
            className="flex items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copied ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
            {copied ? '已复制' : '复制思维链'}
          </button>
          <span className="flex items-center gap-1">{statusIndicator}</span>
        </div>
      </div>

      {typeof progressPercent === 'number' && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/80">
            <span>推理进度</span>
            <span>
              {Math.min(steps.length, displayTotal)}/{displayTotal}
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand via-brand/80 to-brand/50 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {virtualized.items.map(({ step, originalIndex }, index) => {
          const order = formatStepOrder(step, originalIndex);
          const isLatest = originalIndex === latestIndex;
          const isActive = isLatest && isStreaming && !finished;
          const shouldShowMarker =
            collapsed &&
            virtualized.markerIndex !== null &&
            virtualized.hiddenCount > 0 &&
            index === virtualized.markerIndex;

          return (
            <React.Fragment key={step.id || `${order}-${originalIndex}`}>
              {shouldShowMarker && (
                <div className="flex items-center justify-center text-[11px] text-muted-foreground/80">
                  <div className="flex w-full items-center gap-2">
                    <span className="h-px flex-1 bg-border/50" />
                    <button
                      type="button"
                      onClick={() => setViewMode(FULL_VIEW)}
                      className="rounded-full border border-dashed border-border/80 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                    >
                      展开剩余 {hiddenCount} 步
                    </button>
                    <span className="h-px flex-1 bg-border/50" />
                  </div>
                </div>
              )}
              <div className="relative flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                      isActive
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    {order}
                  </div>
                  {index !== virtualized.items.length - 1 && (
                    <div className="mt-1 h-full w-px flex-1 bg-border/60" />
                  )}
                </div>
                <div
                  className={`flex-1 rounded-xl bg-background/60 px-3 py-2 text-sm transition-colors ${
                    isActive ? 'shadow-sm ring-1 ring-brand/20' : ''
                  }`}
                >
                  {step.title && (
                    <div className="text-xs font-semibold text-foreground/90">
                      {step.title}
                    </div>
                  )}
                  {step.content && (
                    <div
                      className={`mt-1 whitespace-pre-wrap leading-relaxed ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.content}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {typeof effectiveTotal === 'number' && (
        <div className="mt-3 text-xs text-muted-foreground">
          {shouldCollapse && viewMode === CORE_VIEW
            ? `已展示关键 ${virtualized.items.length} 步 / 共 ${displayTotal} 步`
            : `已展示 ${Math.min(steps.length, displayTotal)} / ${displayTotal} 步`}
        </div>
      )}

      {shouldCollapse && viewMode === FULL_VIEW && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setViewMode(CORE_VIEW)}
            className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
          >
            收起思维链
          </button>
        </div>
      )}
    </div>
  );
};

export default ReasoningTrail;
