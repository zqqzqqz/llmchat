"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatLogService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("@/utils/db");
const appConfig_1 = require("@/utils/appConfig");
const ObservabilityDispatcher_1 = require("@/services/ObservabilityDispatcher");
class ChatLogService {
    constructor() {
        this.observability = ObservabilityDispatcher_1.ObservabilityDispatcher.getInstance();
        const cfg = (0, appConfig_1.loadAppConfig)();
        const cfgLog = cfg.logging || {};
        this.enabled =
            cfgLog.enabled ?? ((process.env.LOG_CHAT_RESPONSES ?? 'true') === 'true');
        this.logDir =
            cfgLog.dir || process.env.LOG_CHAT_DIR || path_1.default.resolve(__dirname, '../../..', 'log');
        this.recordNormal = cfgLog.record?.normal ?? true;
        this.recordStream = cfgLog.record?.stream ?? true;
        this.includeRaw = cfgLog.include?.raw ?? true;
        this.includeNormalized = cfgLog.include?.normalized ?? true;
    }
    ensureDir() {
        try {
            if (!fs_1.default.existsSync(this.logDir)) {
                fs_1.default.mkdirSync(this.logDir, { recursive: true });
            }
        }
        catch (e) {
            console.warn('[ChatLogService] 创建日志目录失败:', e);
        }
    }
    getLogFilePath() {
        const date = new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const file = `chat-${y}${m}${d}.log`;
        return path_1.default.join(this.logDir, file);
    }
    appendFile(entry) {
        if (!this.enabled)
            return;
        this.ensureDir();
        const line = JSON.stringify(entry) + '\n';
        try {
            fs_1.default.appendFile(this.getLogFilePath(), line, (err) => {
                if (err)
                    console.warn('[ChatLogService] 写入日志失败:', err);
            });
        }
        catch (e) {
            console.warn('[ChatLogService] 追加日志异常:', e);
        }
    }
    async appendDb(level, message) {
        try {
            await (0, db_1.withClient)(async (client) => {
                await client.query('INSERT INTO logs(level, message) VALUES ($1, $2)', [level, message]);
            });
        }
        catch (e) {
            console.warn('[ChatLogService] 数据库写入失败:', e);
        }
    }
    logCompletion(params) {
        if (!this.enabled || !this.recordNormal)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'normal',
            agentId: params.agentId,
            provider: params.provider,
            endpoint: params.endpoint,
            requestMeta: params.requestMeta,
            rawResponse: this.includeRaw ? params.rawResponse : undefined,
            normalizedResponse: this.includeNormalized ? params.normalizedResponse : undefined,
        };
        this.appendFile(entry);
        this.appendDb('INFO', JSON.stringify(entry));
        this.pushObservability('normal', 'INFO', {
            agentId: params.agentId,
            provider: params.provider,
            endpoint: params.endpoint,
            payload: {
                requestMeta: params.requestMeta,
                rawResponse: this.includeRaw ? params.rawResponse ?? null : null,
                normalizedResponse: this.includeNormalized ? params.normalizedResponse ?? null : null,
            },
            timestamp: entry.timestamp,
        });
    }
    logStreamEvent(params) {
        if (!this.enabled || !this.recordStream)
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            type: 'stream',
            agentId: params.agentId,
            provider: params.provider,
            endpoint: params.endpoint,
            chatId: params.chatId,
            eventType: params.eventType,
            data: params.data,
        };
        this.appendFile(entry);
        {
            const level = params.eventType === 'error' ? 'ERROR' : 'INFO';
            this.appendDb(level, JSON.stringify(entry));
            const obsPayload = {
                agentId: params.agentId,
                payload: params.data ?? null,
                timestamp: entry.timestamp,
            };
            if (params.provider)
                obsPayload.provider = params.provider;
            if (params.endpoint)
                obsPayload.endpoint = params.endpoint;
            if (params.chatId)
                obsPayload.chatId = params.chatId;
            if (params.eventType)
                obsPayload.eventType = params.eventType;
            this.pushObservability('stream', level, obsPayload);
        }
    }
    pushObservability(channel, level, payload) {
        try {
            if (!this.observability.isEnabled())
                return;
            const event = {
                timestamp: payload.timestamp,
                channel,
                level,
                agentId: payload.agentId,
                payload: payload.payload ?? null,
            };
            if (payload.provider) {
                event.provider = payload.provider;
            }
            if (payload.endpoint) {
                event.endpoint = payload.endpoint;
            }
            if (payload.chatId) {
                event.chatId = payload.chatId;
            }
            if (payload.eventType) {
                event.eventType = payload.eventType;
            }
            this.observability.enqueue(event);
        }
        catch (error) {
            console.warn('[ChatLogService] 推送观测事件失败:', error);
        }
    }
}
exports.ChatLogService = ChatLogService;
//# sourceMappingURL=ChatLogService.js.map