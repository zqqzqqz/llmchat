"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityDispatcher = void 0;
const axios_1 = __importDefault(require("axios"));
const appConfig_1 = require("@/utils/appConfig");
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FLUSH_INTERVAL = 2000;
class ObservabilityDispatcher {
    static getInstance() {
        if (!ObservabilityDispatcher.instance) {
            ObservabilityDispatcher.instance = new ObservabilityDispatcher((0, appConfig_1.loadAppConfig)());
        }
        return ObservabilityDispatcher.instance;
    }
    constructor(config) {
        this.exporters = [];
        this.queue = [];
        this.flushing = false;
        this.flushTimer = null;
        const configExporters = (config.logging?.exporters ?? []).concat((0, appConfig_1.resolveLoggingExportersFromEnv)());
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
    isEnabled() {
        return this.exporters.length > 0;
    }
    enqueue(event) {
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
    scheduleFlush() {
        if (this.flushTimer || !this.isEnabled()) {
            return;
        }
        const interval = Math.min(...this.exporters.map((exp) => exp.flushIntervalMs));
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flush();
        }, interval);
    }
    async flush() {
        if (this.flushing || !this.queue.length || !this.isEnabled()) {
            return;
        }
        this.flushing = true;
        const batch = this.queue.splice(0, this.queue.length);
        await Promise.all(this.exporters.map(async (exporter) => {
            const chunks = chunk(batch, exporter.batchSize);
            for (const slice of chunks) {
                try {
                    await this.sendToExporter(exporter, slice);
                }
                catch (error) {
                    console.warn('[ObservabilityDispatcher] Export failed:', exporter.type, error);
                }
            }
        }));
        this.flushing = false;
        if (this.queue.length) {
            this.scheduleFlush();
        }
    }
    async sendToExporter(exporter, events) {
        if (!events.length)
            return;
        if (!exporter.endpoint)
            return;
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
    async sendToHttp(exporter, events) {
        const config = exporter.headers
            ? { headers: exporter.headers }
            : undefined;
        await axios_1.default.post(exporter.endpoint, { events }, config);
    }
    async sendToElastic(exporter, events) {
        const index = exporter.index || 'fastgpt-events';
        const bulkBody = events
            .map((event) => {
            const action = { index: { _index: index } };
            return `${JSON.stringify(action)}\n${JSON.stringify(event)}`;
        })
            .join('\n') + '\n';
        const headers = {
            'Content-Type': 'application/x-ndjson',
            ...(exporter.headers ?? {}),
        };
        if (exporter.apiKey) {
            headers.Authorization = `ApiKey ${exporter.apiKey}`;
        }
        const config = { headers };
        if (exporter.username || exporter.password) {
            config.auth = { username: exporter.username ?? '', password: exporter.password ?? '' };
        }
        await axios_1.default.post(`${exporter.endpoint.replace(/\/+$/, '')}/_bulk`, bulkBody, config);
    }
    async sendToClickHouse(exporter, events) {
        const table = exporter.table || 'fastgpt_events';
        const payload = events.map((event) => JSON.stringify(event)).join('\n');
        const headers = {
            'Content-Type': 'application/json',
            ...(exporter.headers ?? {}),
        };
        const config = { headers };
        if (exporter.username || exporter.password) {
            config.auth = { username: exporter.username ?? '', password: exporter.password ?? '' };
        }
        await axios_1.default.post(`${exporter.endpoint}?query=${encodeURIComponent(`INSERT INTO ${table} FORMAT JSONEachRow`)}`, payload, config);
    }
}
exports.ObservabilityDispatcher = ObservabilityDispatcher;
ObservabilityDispatcher.instance = null;
function chunk(items, size) {
    const result = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}
//# sourceMappingURL=ObservabilityDispatcher.js.map