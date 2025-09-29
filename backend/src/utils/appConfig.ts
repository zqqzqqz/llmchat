import fs from 'fs';
import path from 'path';
import { stripJsonComments } from './config';

export interface LoggingExporterConfig {
  type: 'http' | 'elasticsearch' | 'clickhouse';
  enabled?: boolean;
  endpoint?: string;
  index?: string;
  table?: string;
  headers?: Record<string, string>;
  apiKey?: string;
  username?: string;
  password?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

export interface AppConfig {
  logging?: {
    enabled?: boolean;
    dir?: string;
    record?: { normal?: boolean; stream?: boolean };
    include?: { raw?: boolean; normalized?: boolean };
    exporters?: LoggingExporterConfig[];
  };
  database?: {
    postgres?: {
      host: string;
      port?: number;
      user: string;
      password: string;
      database: string;
      ssl?: boolean;
    };
  };
  auth?: {
    tokenTTLSeconds?: number;
  };
}

const projectRoot = path.resolve(__dirname, '../../..');

const CONFIG_CANDIDATES = [
  path.join(projectRoot, 'config', 'config.jsonc'),
  path.join(projectRoot, 'config', 'config.json'),
];

export function loadAppConfig(): AppConfig {
  for (const file of CONFIG_CANDIDATES) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, 'utf-8');
      const stripped = stripJsonComments(raw);
      return JSON.parse(stripped) as AppConfig;
    } catch (error) {
      console.warn('[AppConfig] Failed to parse configuration:', file, error);
    }
  }
  return {};
}

export function resolveLoggingExportersFromEnv(): LoggingExporterConfig[] {
  const exporters: LoggingExporterConfig[] = [];
  const httpEndpoint = process.env.LOG_EXPORT_HTTP_ENDPOINT;
  if (httpEndpoint) {
    const exporter: LoggingExporterConfig = {
      type: 'http',
      endpoint: httpEndpoint,
      batchSize: parseNumberEnv(process.env.LOG_EXPORT_HTTP_BATCH, 25),
      flushIntervalMs: parseNumberEnv(process.env.LOG_EXPORT_HTTP_INTERVAL, 2000),
    };
    const headers = parseHeadersEnv(process.env.LOG_EXPORT_HTTP_HEADERS);
    if (headers) {
      exporter.headers = headers;
    }
    exporters.push(exporter);
  }
  return exporters;
}

function parseHeadersEnv(headers?: string | null): Record<string, string> | undefined {
  if (!headers) return undefined;
  try {
    const parsed = JSON.parse(headers);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {});
    }
  } catch (error) {
    console.warn('[AppConfig] Failed to parse LOG_EXPORT_HTTP_HEADERS env:', error);
  }
  return undefined;
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
