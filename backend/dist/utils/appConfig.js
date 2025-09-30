"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAppConfig = loadAppConfig;
exports.resolveLoggingExportersFromEnv = resolveLoggingExportersFromEnv;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const projectRoot = path_1.default.resolve(__dirname, '../../..');
const CONFIG_CANDIDATES = [
    path_1.default.join(projectRoot, 'config', 'config.jsonc'),
    path_1.default.join(projectRoot, 'config', 'config.json'),
];
function loadAppConfig() {
    for (const file of CONFIG_CANDIDATES) {
        try {
            if (!fs_1.default.existsSync(file))
                continue;
            const raw = fs_1.default.readFileSync(file, 'utf-8');
            const stripped = (0, config_1.stripJsonComments)(raw);
            return JSON.parse(stripped);
        }
        catch (error) {
            console.warn('[AppConfig] Failed to parse configuration:', file, error);
        }
    }
    return {};
}
function resolveLoggingExportersFromEnv() {
    const exporters = [];
    const httpEndpoint = process.env.LOG_EXPORT_HTTP_ENDPOINT;
    if (httpEndpoint) {
        const exporter = {
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
function parseHeadersEnv(headers) {
    if (!headers)
        return undefined;
    try {
        const parsed = JSON.parse(headers);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return Object.entries(parsed).reduce((acc, [key, value]) => {
                acc[key] = String(value);
                return acc;
            }, {});
        }
    }
    catch (error) {
        console.warn('[AppConfig] Failed to parse LOG_EXPORT_HTTP_HEADERS env:', error);
    }
    return undefined;
}
function parseNumberEnv(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
//# sourceMappingURL=appConfig.js.map