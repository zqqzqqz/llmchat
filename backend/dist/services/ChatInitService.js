"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatInitService = void 0;
const axios_1 = __importDefault(require("axios"));
class ChatInitService {
    constructor(agentService) {
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000;
        this.agentService = agentService;
        this.httpClient = axios_1.default.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    async getInitData(appId, chatId) {
        const cacheKey = `${appId}_${chatId || 'default'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            console.log('✅ 使用缓存的初始化数据');
            return cached.data;
        }
        const agent = await this.agentService.getAgent(appId);
        if (!agent) {
            throw new Error(`智能体不存在: ${appId}`);
        }
        if (agent.provider !== 'fastgpt') {
            throw new Error(`智能体 ${appId} 不是FastGPT类型，无法获取初始化数据`);
        }
        if (!agent.appId || !/^[a-fA-F0-9]{24}$/.test(agent.appId)) {
            throw new Error(`FastGPT 智能体缺少有效的 appId 配置`);
        }
        const initData = await this.callFastGPTInitAPI(agent, chatId);
        this.cache.set(cacheKey, {
            data: initData,
            timestamp: Date.now()
        });
        return initData;
    }
    async getInitDataStream(appId, chatId, onChunk, onComplete, onError) {
        try {
            const initData = await this.getInitData(appId, chatId);
            const welcomeText = initData.app.chatConfig.welcomeText || '';
            if (!welcomeText) {
                onComplete(initData);
                return;
            }
            const normalizedWelcomeText = this.normalizeWelcomeText(welcomeText);
            await this.streamWelcomeText(normalizedWelcomeText, onChunk);
            onComplete(initData);
        }
        catch (error) {
            onError(error instanceof Error ? error : new Error('获取初始化数据失败'));
        }
    }
    async callFastGPTInitAPI(agent, chatId) {
        try {
            const baseUrl = agent.endpoint.replace('/api/v1/chat/completions', '');
            const initUrl = `${baseUrl}/api/core/chat/init`;
            const params = { appId: agent.appId };
            if (chatId) {
                params.chatId = chatId;
            }
            console.log(`🚀 调用FastGPT初始化API: ${initUrl}`, params);
            const response = await this.httpClient.get(initUrl, {
                params,
                headers: {
                    'Authorization': `Bearer ${agent.apiKey}`,
                },
            });
            if (response.data.code !== 200) {
                throw new Error(`FastGPT API错误: ${response.data.message || '未知错误'}`);
            }
            console.log('✅ FastGPT初始化API调用成功');
            return response.data.data;
        }
        catch (error) {
            console.error('❌ FastGPT初始化API调用失败:', error);
            if (axios_1.default.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message;
                throw new Error(`FastGPT API调用失败: ${message}`);
            }
            throw error;
        }
    }
    async streamWelcomeText(text, onChunk) {
        const chars = Array.from(text);
        const delay = 50;
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            onChunk(char ?? '');
            if (i < chars.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    normalizeWelcomeText(text) {
        if (!text)
            return '';
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\\r/g, '\n');
    }
    clearCache() {
        this.cache.clear();
        console.log('🧹 初始化数据缓存已清除');
    }
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        }
    }
}
exports.ChatInitService = ChatInitService;
//# sourceMappingURL=ChatInitService.js.map