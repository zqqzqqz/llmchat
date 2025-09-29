import fs from 'fs';
import path from 'path';
import { withClient } from '@/utils/db';
import { loadAppConfig } from '@/utils/appConfig';
import { ObservabilityDispatcher } from '@/services/ObservabilityDispatcher';

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

export class ChatLogService {
  private enabled: boolean;
  private logDir: string;
  private recordNormal: boolean;
  private recordStream: boolean;
  private includeRaw: boolean;
  private includeNormalized: boolean;
  private observability = ObservabilityDispatcher.getInstance();

  constructor() {
    const cfg = loadAppConfig();
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

  private appendFile(entry: object) {
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

  private async appendDb(level: 'INFO'|'WARN'|'ERROR', message: string) {
    try {
      await withClient(async (client) => {
        await client.query('INSERT INTO logs(level, message) VALUES ($1, $2)', [level, message]);
      });
    } catch (e) {
      console.warn('[ChatLogService] 数据库写入失败:', e);
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
    this.appendFile(entry);
    {
      const level: 'INFO' | 'WARN' | 'ERROR' =
        params.eventType === 'error' ? 'ERROR' : 'INFO';
      this.appendDb(level, JSON.stringify(entry));
      const obsPayload: {
        agentId: string;
        payload: any;
        timestamp: string;
        provider?: string;
        endpoint?: string;
        chatId?: string;
        eventType?: string;
      } = {
        agentId: params.agentId,
        payload: params.data ?? null,
        timestamp: entry.timestamp,
      };
      if (params.provider) obsPayload.provider = params.provider;
      if (params.endpoint) obsPayload.endpoint = params.endpoint;
      if (params.chatId) obsPayload.chatId = params.chatId;
      if (params.eventType) obsPayload.eventType = params.eventType;
      this.pushObservability('stream', level, obsPayload);
    }
  }

  private pushObservability(
    channel: 'normal' | 'stream',
    level: 'INFO' | 'WARN' | 'ERROR',
    payload: {
      agentId: string;
      provider?: string;
      endpoint?: string;
      chatId?: string;
      eventType?: string;
      payload: any;
      timestamp: string;
    }
  ) {
    try {
      if (!this.observability.isEnabled()) return;
      const event: import('./ObservabilityDispatcher').ObservabilityEvent = {
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
    } catch (error) {
      console.warn('[ChatLogService] 推送观测事件失败:', error);
    }
  }
}

