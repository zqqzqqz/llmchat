import fs from 'fs';
import path from 'path';

interface NormalLogEntry {
  timestamp: string;
  type: 'normal';
  agentId: string;
  provider: string;
  endpoint: string;
  requestMeta?: Record<string, any> | undefined;
  rawResponse?: any | undefined;
  normalizedResponse?: any | undefined;
}

interface StreamLogEntry {
  timestamp: string;
  type: 'stream';
  agentId: string;
  provider?: string | undefined;
  endpoint?: string | undefined;
  chatId?: string | undefined;
  eventType: string;
  data: any;
}

type AppConfig = {
  logging?: {
    enabled?: boolean;
    dir?: string;
    record?: { normal?: boolean; stream?: boolean };
    include?: { raw?: boolean; normalized?: boolean };
  };
};

function stripComments(input: string): string {
  // 去除 /* */ 与 // 注释
  const withoutBlock = input.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlock.replace(/(^|\s)\/\/.*$/gm, '');
}

function tryLoadAppConfig(): AppConfig {
  const root = path.resolve(__dirname, '../../..');
  const candidates = [
    path.join(root, 'config', 'config.jsonc'),
    path.join(root, 'config', 'config.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const json = JSON.parse(stripComments(raw));
        return json as AppConfig;
      }
    } catch (e) {
      console.warn('[ChatLogService] 解析配置失败:', p, e);
    }
  }
  return {};
}

export class ChatLogService {
  private enabled: boolean;
  private logDir: string;
  private recordNormal: boolean;
  private recordStream: boolean;
  private includeRaw: boolean;
  private includeNormalized: boolean;

  constructor() {
    const cfg = tryLoadAppConfig();
    const cfgLog = cfg.logging || {};

    // 默认开启，允许通过配置文件/环境变量关闭
    this.enabled =
      cfgLog.enabled ?? ((process.env.LOG_CHAT_RESPONSES ?? 'true') === 'true');

    // 默认写入项目根目录 ./log（以编译后 dist 下 __dirname 回溯到仓库根）
    this.logDir =
      cfgLog.dir || process.env.LOG_CHAT_DIR || path.resolve(__dirname, '../../..', 'log');

    // 记录范围（默认：都记录）
    this.recordNormal = cfgLog.record?.normal ?? true;
    this.recordStream = cfgLog.record?.stream ?? true;

    // 输出内容（默认：都包含）
    this.includeRaw = cfgLog.include?.raw ?? true;
    this.includeNormalized = cfgLog.include?.normalized ?? true;
  }

  private ensureDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (e) {
      // 避免影响主流程
      console.warn('[ChatLogService] 创建日志目录失败:', e);
    }
  }

  private getLogFilePath(): string {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const file = `chat-${y}${m}${d}.log`;
    return path.join(this.logDir, file);
  }

  private append(entry: object) {
    if (!this.enabled) return;
    this.ensureDir();
    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFile(this.getLogFilePath(), line, (err) => {
        if (err) console.warn('[ChatLogService] 写入日志失败:', err);
      });
    } catch (e) {
      console.warn('[ChatLogService] 追加日志异常:', e);
    }
  }

  logCompletion(params: {
    agentId: string;
    provider: string;
    endpoint: string;
    requestMeta?: Record<string, any>;
    rawResponse?: any;
    normalizedResponse?: any;
  }) {
    if (!this.enabled || !this.recordNormal) return;
    const entry: NormalLogEntry = {
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

  logStreamEvent(params: {
    agentId: string;
    chatId?: string;
    provider?: string;
    endpoint?: string;
    eventType: string;
    data: any;
  }) {
    if (!this.enabled || !this.recordStream) return;
    const entry: StreamLogEntry = {
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

