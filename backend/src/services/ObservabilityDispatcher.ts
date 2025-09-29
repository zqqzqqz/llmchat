import axios from 'axios';
import type { AppConfig, LoggingExporterConfig } from '@/utils/appConfig';
import { loadAppConfig, resolveLoggingExportersFromEnv } from '@/utils/appConfig';

export interface ObservabilityEvent {
  timestamp: string;
  channel: 'normal' | 'stream';
  level: 'INFO' | 'WARN' | 'ERROR';
  agentId: string;
  provider?: string;
  endpoint?: string;
  chatId?: string;
  eventType?: string;
  payload: Record<string, any> | null;
}

interface RuntimeExporter extends LoggingExporterConfig {
  batchSize: number;
  flushIntervalMs: number;
}

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FLUSH_INTERVAL = 2000;

export class ObservabilityDispatcher {
  private static instance: ObservabilityDispatcher | null = null;

  static getInstance(): ObservabilityDispatcher {
    if (!ObservabilityDispatcher.instance) {
      ObservabilityDispatcher.instance = new ObservabilityDispatcher(loadAppConfig());
    }
    return ObservabilityDispatcher.instance;
  }

  private readonly exporters: RuntimeExporter[] = [];
  private readonly queue: ObservabilityEvent[] = [];
  private flushing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minBatchSize: number;

  private constructor(config: AppConfig) {
    const configExporters = (config.logging?.exporters ?? []).concat(resolveLoggingExportersFromEnv());
    this.exporters = configExporters
      .filter((exp) => exp && exp.enabled !== false && exp.type)
      .map((exp) => ({
        ...exp,
        batchSize: Math.max(1, exp.batchSize ?? DEFAULT_BATCH_SIZE),
        flushIntervalMs: Math.max(250, exp.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL),
      }));
    this.minBatchSize = this.exporters.length > 0
      ? Math.min(...this.exporters.map((exp) => exp.batchSize))
      : DEFAULT_BATCH_SIZE;
  }

  isEnabled(): boolean {
    return this.exporters.length > 0;
  }

  enqueue(event: ObservabilityEvent): void {
    if (!this.isEnabled()) {
      return;
    }
    this.queue.push(event);
    if (this.queue.length >= this.minBatchSize) {
      void this.flush();
      return;
    }
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer || !this.isEnabled()) {
      return;
    }
    const interval = Math.min(...this.exporters.map((exp) => exp.flushIntervalMs));
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, interval);
  }

  private async flush(): Promise<void> {
    if (this.flushing || !this.queue.length || !this.isEnabled()) {
      return;
    }
    this.flushing = true;
    const batch = this.queue.splice(0, this.queue.length);
    await Promise.all(
      this.exporters.map(async (exporter) => {
        const chunks = chunk(batch, exporter.batchSize);
        for (const slice of chunks) {
          try {
            await this.sendToExporter(exporter, slice);
          } catch (error) {
            console.warn('[ObservabilityDispatcher] Export failed:', exporter.type, error);
          }
        }
      })
    );
    this.flushing = false;
    if (this.queue.length) {
      this.scheduleFlush();
    }
  }

  private async sendToExporter(exporter: RuntimeExporter, events: ObservabilityEvent[]): Promise<void> {
    if (!events.length) return;
    if (!exporter.endpoint) return;

    switch (exporter.type) {
      case 'elasticsearch':
        await this.sendToElastic(exporter, events);
        break;
      case 'clickhouse':
        await this.sendToClickHouse(exporter, events);
        break;
      default:
        await this.sendToHttp(exporter, events);
    }
  }

  private async sendToHttp(exporter: RuntimeExporter, events: ObservabilityEvent[]): Promise<void> {
    const config: Parameters<typeof axios.post>[2] | undefined = exporter.headers
      ? { headers: exporter.headers }
      : undefined;
    await axios.post(exporter.endpoint!, { events }, config);
  }

  private async sendToElastic(exporter: RuntimeExporter, events: ObservabilityEvent[]): Promise<void> {
    const index = exporter.index || 'fastgpt-events';
    const bulkBody = events
      .map((event) => {
        const action = { index: { _index: index } };
        return `${JSON.stringify(action)}\n${JSON.stringify(event)}`;
      })
      .join('\n') + '\n';

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-ndjson',
      ...(exporter.headers ?? {}),
    };
    if (exporter.apiKey) {
      headers.Authorization = `ApiKey ${exporter.apiKey}`;
    }
    const config: Parameters<typeof axios.post>[2] = { headers };
    if (exporter.username || exporter.password) {
      config.auth = { username: exporter.username ?? '', password: exporter.password ?? '' };
    }

    await axios.post(`${exporter.endpoint!.replace(/\/+$/, '')}/_bulk`, bulkBody, config);
  }

  private async sendToClickHouse(exporter: RuntimeExporter, events: ObservabilityEvent[]): Promise<void> {
    const table = exporter.table || 'fastgpt_events';
    const payload = events.map((event) => JSON.stringify(event)).join('\n');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(exporter.headers ?? {}),
    };
    const config: Parameters<typeof axios.post>[2] = { headers };
    if (exporter.username || exporter.password) {
      config.auth = { username: exporter.username ?? '', password: exporter.password ?? '' };
    }
    await axios.post(
      `${exporter.endpoint}?query=${encodeURIComponent(`INSERT INTO ${table} FORMAT JSONEachRow`)}`,
      payload,
      config
    );
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
