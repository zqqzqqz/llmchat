"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatLogService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function stripComments(input) {
    const withoutBlock = input.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlock.replace(/(^|\s)\/\/.*$/gm, '');
}
function tryLoadAppConfig() {
    const root = path_1.default.resolve(__dirname, '../../..');
    const candidates = [
        path_1.default.join(root, 'config', 'config.jsonc'),
        path_1.default.join(root, 'config', 'config.json'),
    ];
    for (const p of candidates) {
        try {
            if (fs_1.default.existsSync(p)) {
                const raw = fs_1.default.readFileSync(p, 'utf-8');
                const json = JSON.parse(stripComments(raw));
                return json;
            }
        }
        catch (e) {
            console.warn('[ChatLogService] 解析配置失败:', p, e);
        }
    }
    return {};
}
class ChatLogService {
    constructor() {
        const cfg = tryLoadAppConfig();
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
    append(entry) {
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
        this.append(entry);
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
        this.append(entry);
    }
}
exports.ChatLogService = ChatLogService;
//# sourceMappingURL=ChatLogService.js.map