import React, { useEffect, useMemo, useState } from 'react';
import { FastGPTEvent } from '@/types';
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface EventTrailProps {
  events: FastGPTEvent[];
}

const INITIAL_VISIBLE_EVENTS = 8;
const LOAD_MORE_STEP = 6;

const levelConfig = {
  info: {
    icon: Info,
    badge: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200',
  },
  success: {
    icon: CheckCircle2,
    badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  warning: {
    icon: AlertTriangle,
    badge: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200',
  },
  error: {
    icon: AlertCircle,
    badge: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200',
  },
} as const;

const formatTime = (timestamp: number) => {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
};

export const EventTrail: React.FC<EventTrailProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return null;
  }

  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(events.length, INITIAL_VISIBLE_EVENTS)
  );

  useEffect(() => {
    setVisibleCount(Math.min(events.length, INITIAL_VISIBLE_EVENTS));
  }, [events.length]);

  const visibleEvents = useMemo(() => {
    if (events.length <= visibleCount) {
      return events;
    }
    return events.slice(events.length - visibleCount);
  }, [events, visibleCount]);

  const hiddenCount = Math.max(events.length - visibleEvents.length, 0);

  return (
    <div className="mb-3 space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">事件进展</div>

      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(events.length, prev + LOAD_MORE_STEP))}
            className="rounded-full border border-dashed border-border/70 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
          >
            展开更多事件（剩余 {hiddenCount} 条）
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {visibleEvents.map((event) => {
          const config = levelConfig[event.level] ?? levelConfig.info;
          const Icon = config.icon;

          return (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm"
            >
              <span className={clsx('mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium', config.badge)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">{event.label}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(event.timestamp)}</span>
                </div>
                {event.summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{event.summary}</p>
                )}
                <details className="group text-[11px] text-muted-foreground/80">
                  <summary className="cursor-pointer select-none text-[11px] font-medium text-muted-foreground/90 transition-colors hover:text-foreground">
                    查看原始数据
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
                    {typeof event.payload === 'string'
                      ? event.payload
                      : JSON.stringify(event.payload, null, 2)}
                  </pre>
                </details>
              </div>
            </li>
          );
        })}
      </ul>

      {events.length > INITIAL_VISIBLE_EVENTS && visibleCount === events.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount(Math.min(events.length, INITIAL_VISIBLE_EVENTS))}
            className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
          >
            收起事件时间线
          </button>
        </div>
      )}
    </div>
  );
};

export default EventTrail;
