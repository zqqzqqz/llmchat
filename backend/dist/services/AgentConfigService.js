"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentConfigService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class AgentConfigService {
    constructor(configPath) {
        this.agents = new Map();
        this.lastLoadTime = 0;
        this.CACHE_TTL = 5 * 60 * 1000;
        this.configPath = configPath ||
            process.env.AGENTS_CONFIG_PATH ||
            path_1.default.join(__dirname, '../../../config/agents.json');
    }
    async loadAgents() {
        try {
            const now = Date.now();
            if (this.agents.size > 0 && now - this.lastLoadTime < this.CACHE_TTL) {
                return Array.from(this.agents.values());
            }
            const configData = await promises_1.default.readFile(this.configPath, 'utf-8');
            const config = JSON.parse(configData);
            if (!config.agents || !Array.isArray(config.agents)) {
                throw new Error('配置文件格式错误：缺少agents数组');
            }
            this.agents.clear();
            for (const agentConfig of config.agents) {
                if (this.validateAgentConfig(agentConfig)) {
                    this.agents.set(agentConfig.id, agentConfig);
                }
                else {
                    console.warn(`智能体配置验证失败: ${agentConfig.id || '未知ID'}`);
                }
            }
            this.lastLoadTime = now;
            console.log(`✅ 成功加载 ${this.agents.size} 个智能体配置`);
            return Array.from(this.agents.values());
        }
        catch (error) {
            console.error('加载智能体配置失败:', error);
            throw new Error(`无法加载智能体配置: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    async getAgent(id) {
        if (this.agents.size === 0) {
            await this.loadAgents();
        }
        return this.agents.get(id) || null;
    }
    async getAvailableAgents() {
        const configs = await this.loadAgents();
        return configs
            .filter(config => config.isActive)
            .map(config => this.transformToAgent(config));
    }
    async getAllAgents() {
        const configs = await this.loadAgents();
        return configs.map(config => this.transformToAgent(config));
    }
    async checkAgentHealth(id) {
        const config = await this.getAgent(id);
        if (!config) {
            return {
                agentId: id,
                status: 'error',
                lastChecked: new Date().toISOString(),
                error: '智能体不存在',
            };
        }
        const startTime = Date.now();
        let status = 'inactive';
        let error;
        try {
            if (config.isActive) {
                status = 'active';
            }
        }
        catch (err) {
            status = 'error';
            error = err instanceof Error ? err.message : '健康检查失败';
        }
        const result = {
            agentId: id,
            status,
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
        };
        if (error) {
            result.error = error;
        }
        return result;
    }
    validateAgentConfig(config) {
        const requiredFields = ['id', 'name', 'description', 'endpoint', 'apiKey', 'model', 'provider'];
        for (const field of requiredFields) {
            if (!config[field]) {
                console.error(`智能体配置缺少必需字段: ${field}`);
                return false;
            }
        }
        if (this.agents.has(config.id)) {
            console.error(`智能体ID重复: ${config.id}`);
            return false;
        }
        if (config.provider === 'fastgpt') {
            if (!config.appId || typeof config.appId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(config.appId)) {
                console.error(`FastGPT 配置缺少有效的 appId（需要 24 位十六进制字符串）: ${config.id}`);
                return false;
            }
        }
        const validProviders = ['fastgpt', 'openai', 'anthropic', 'custom'];
        if (!validProviders.includes(config.provider)) {
            console.error(`不支持的provider: ${config.provider}`);
            return false;
        }
        try {
            const endpointUrl = config.endpoint.startsWith('http')
                ? config.endpoint
                : `https://${config.endpoint}`;
            new URL(endpointUrl);
        }
        catch {
            console.error(`无效的endpoint URL: ${config.endpoint}`);
            return false;
        }
        return true;
    }
    transformToAgent(config) {
        return {
            id: config.id,
            name: config.name,
            description: config.description,
            model: config.model,
            status: config.isActive ? 'active' : 'inactive',
            capabilities: config.capabilities,
            provider: config.provider,
        };
    }
    async reloadAgents() {
        this.lastLoadTime = 0;
        this.agents.clear();
        return this.loadAgents();
    }
    async updateAgent(id, updates) {
        const config = await this.getAgent(id);
        if (!config) {
            throw new Error(`智能体不存在: ${id}`);
        }
        const updatedConfig = {
            ...config,
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        if (!this.validateAgentConfig(updatedConfig)) {
            throw new Error('更新后的配置验证失败');
        }
        this.agents.set(id, updatedConfig);
        await this.saveAgentsToFile();
    }
    async saveAgentsToFile() {
        try {
            const config = {
                agents: Array.from(this.agents.values()),
            };
            await promises_1.default.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
            console.log('✅ 智能体配置已保存');
        }
        catch (error) {
            console.error('保存智能体配置失败:', error);
            throw new Error('无法保存智能体配置');
        }
    }
}
exports.AgentConfigService = AgentConfigService;
//# sourceMappingURL=AgentConfigService.js.map