import axios from 'axios';
import { AgentConfigService } from './AgentConfigService';
import { AgentConfig, FastGPTInitResponse } from '@/types';
import { AdaptiveTtlPolicy } from '@/utils/adaptiveCache';

/**
 * 聊天初始化服务
 * 负责调用FastGPT的初始化API并处理流式输出
 */
export class ChatInitService {
  private httpClient: ReturnType<typeof axios.create>;
  private agentService: AgentConfigService;
  private cache: Map<string, { data: FastGPTInitResponse; expiresAt: number }> = new Map();
  private readonly cachePolicy = new AdaptiveTtlPolicy({
    initialTtl: 5 * 60 * 1000,
    minTtl: 60 * 1000,
    maxTtl: 15 * 60 * 1000,
    step: 60 * 1000,
    sampleSize: 20,
    adjustIntervalMs: 2 * 60 * 1000,
  });

  constructor(agentService: AgentConfigService) {
    this.agentService = agentService;
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 获取初始化数据（非流式）
   */
  async getInitData(appId: string, chatId?: string): Promise<FastGPTInitResponse> {
    // 检查缓存
    const cacheKey = `${appId}_${chatId || 'default'}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      console.log('✅ 使用缓存的初始化数据');
      this.cachePolicy.recordHit();
      return cached.data;
    }

    this.cachePolicy.recordMiss();

    // 获取智能体配置（此处的 appId 实际是前端传入的智能体ID）
    const agent = await this.agentService.getAgent(appId);
    if (!agent) {
      throw new Error(`智能体不存在: ${appId}`);
    }

    if (agent.provider !== 'fastgpt') {
      throw new Error(`智能体 ${appId} 不是FastGPT类型，无法获取初始化数据`);
    }

    // 额外校验：FastGPT 必须配置 appId（24位hex），避免将智能体ID误传给 FastGPT
    if (!agent.appId || !/^[a-fA-F0-9]{24}$/.test(agent.appId)) {
      throw new Error(`FastGPT 智能体缺少有效的 appId 配置`);
    }

    // 调用FastGPT API（传递真实的 FastGPT appId，而非本地的智能体ID）
    const initData = await this.callFastGPTInitAPI(agent, chatId);
    
    // 缓存结果
    this.cache.set(cacheKey, {
      data: initData,
      expiresAt: Date.now() + this.cachePolicy.getTtl(),
    });

    return initData;
  }

  /**
   * 获取初始化数据（流式）
   */
  async getInitDataStream(
    appId: string, 
    chatId: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete: (data: FastGPTInitResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // 先获取完整的初始化数据
      const initData = await this.getInitData(appId, chatId);
      
      // 提取开场白文本
      const welcomeText = initData.app.chatConfig.welcomeText || '';
      
      if (!welcomeText) {
        // 如果没有开场白，直接返回完整数据
        onComplete(initData);
        return;
      }

      // 在流式输出前进行换行规范化，将字面量 "\n"/"\r\n" 转换为真实换行符
      const normalizedWelcomeText = this.normalizeWelcomeText(welcomeText);

      // 流式输出开场白文本
      await this.streamWelcomeText(normalizedWelcomeText, onChunk);
      
      // 流式输出完成后，返回完整数据
      onComplete(initData);
      
    } catch (error) {
      onError(error instanceof Error ? error : new Error('获取初始化数据失败'));
    }
  }

  /**
   * 调用FastGPT初始化API
   */
  private async callFastGPTInitAPI(
    agent: AgentConfig, 
    chatId?: string
  ): Promise<FastGPTInitResponse> {
    try {
      // 构建FastGPT API URL
      const baseUrl = agent.endpoint.replace('/api/v1/chat/completions', '');
      const initUrl = `${baseUrl}/api/core/chat/init`;
      
      // 构建请求参数：使用 agent.appId 作为 FastGPT 的 appId
      const params: any = { appId: agent.appId };
      if (chatId) {
        params.chatId = chatId;
      }

      console.log(`🚀 调用FastGPT初始化API: ${initUrl}`, params);

      // 发送请求
      const response = await this.httpClient.get(initUrl, {
        params,
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`,
        },
      });

      const responseData = response.data as any;
      if (responseData.code !== 200) {
        throw new Error(`FastGPT API错误: ${responseData.message || '未知错误'}`);
      }

      console.log('✅ FastGPT初始化API调用成功');
      return responseData.data;

    } catch (error) {
      console.error('❌ FastGPT初始化API调用失败:', error);
      if (error && typeof error === 'object' && 'isAxiosError' in error && (error as any).isAxiosError) {
        const axiosError = error as any;
        const message = axiosError.response?.data?.message || axiosError.message;
        throw new Error(`FastGPT API调用失败: ${message}`);
      }
      throw error;
    }
  }

  /**
   * 流式输出开场白文本
   */
  private async streamWelcomeText(
    text: string, 
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // 将文本按字符分割，模拟打字机效果
    const chars = Array.from(text);
    const delay = 50; // 每个字符间隔50ms

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      onChunk(char ?? '');

      // 添加延迟，模拟真实的打字效果
      if (i < chars.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 将字面量换行标记标准化为真实换行，且统一为 \n
  private normalizeWelcomeText(text: string): string {
    if (!text) return '';
    return text
      // 已经存在的真实 CRLF -> LF
      .replace(/\r\n/g, '\n')
      // 字面量 "\\r\\n" -> LF
      .replace(/\\r\\n/g, '\n')
      // 字面量 "\\n" -> LF
      .replace(/\\n/g, '\n')
      // 单独真实 CR -> LF
      .replace(/\r/g, '\n')
      // 字面量 "\\r" -> LF
      .replace(/\\r/g, '\n');
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.cachePolicy.reset();
    console.log('🧹 初始化数据缓存已清除');
  }

  /**
   * 清除过期缓存
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}