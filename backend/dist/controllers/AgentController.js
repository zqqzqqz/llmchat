"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const AgentConfigService_1 = require("@/services/AgentConfigService");
const ChatProxyService_1 = require("@/services/ChatProxyService");
const authInstance_1 = require("@/services/authInstance");
async function ensureAdminAuth(req) {
    const auth = req.headers['authorization'];
    const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
    if (!token)
        throw new Error('UNAUTHORIZED');
    const user = await authInstance_1.authService.profile(token);
    if (!user || user.role !== 'admin')
        throw new Error('UNAUTHORIZED');
    return user;
}
class AgentController {
    constructor() {
        this.getAgents = async (req, res, next) => {
            try {
                const includeInactive = req.query.includeInactive === 'true';
                const agents = includeInactive
                    ? await this.agentService.getAllAgents()
                    : await this.agentService.getAvailableAgents();
                res.json({
                    success: true,
                    data: agents,
                    total: agents.length,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                console.error('获取智能体列表失败:', error);
                const apiError = {
                    code: 'GET_AGENTS_FAILED',
                    message: '获取智能体列表失败',
                    timestamp: new Date().toISOString(),
                };
                if (process.env.NODE_ENV === 'development') {
                    apiError.details = { error: error instanceof Error ? error.message : error };
                }
                res.status(500).json(apiError);
            }
        };
        this.getAgent = async (req, res, next) => {
            try {
                const { id } = req.params;
                if (!id) {
                    const apiError = {
                        code: 'INVALID_AGENT_ID',
                        message: '智能体ID不能为空',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const config = await this.agentService.getAgent(id);
                if (!config) {
                    const apiError = {
                        code: 'AGENT_NOT_FOUND',
                        message: `智能体不存在: ${id}`,
                        timestamp: new Date().toISOString(),
                    };
                    res.status(404).json(apiError);
                    return;
                }
                const agent = {
                    id: config.id,
                    name: config.name,
                    description: config.description,
                    model: config.model,
                    status: config.isActive ? 'active' : 'inactive',
                    capabilities: config.capabilities,
                    provider: config.provider,
                    features: {
                        supportsStream: config.features.supportsStream,
                        supportsFiles: config.features.supportsFiles,
                        supportsImages: config.features.supportsImages,
                        supportsChatId: config.features.supportsChatId,
                    },
                    rateLimit: config.rateLimit,
                    createdAt: config.createdAt,
                    updatedAt: config.updatedAt,
                };
                res.json({
                    success: true,
                    data: agent,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                console.error('获取智能体信息失败:', error);
                const apiError = {
                    code: 'GET_AGENT_FAILED',
                    message: '获取智能体信息失败',
                    timestamp: new Date().toISOString(),
                };
                if (process.env.NODE_ENV === 'development') {
                    apiError.details = { error: error instanceof Error ? error.message : error };
                }
                res.status(500).json(apiError);
            }
        };
        this.getAgentStatus = async (req, res, next) => {
            try {
                const { id } = req.params;
                if (!id) {
                    const apiError = {
                        code: 'INVALID_AGENT_ID',
                        message: '智能体ID不能为空',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const healthStatus = await this.agentService.checkAgentHealth(id);
                res.json({
                    success: true,
                    data: healthStatus,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                console.error('检查智能体状态失败:', error);
                const apiError = {
                    code: 'GET_AGENT_STATUS_FAILED',
                    message: '检查智能体状态失败',
                    timestamp: new Date().toISOString(),
                };
                if (process.env.NODE_ENV === 'development') {
                    apiError.details = { error: error instanceof Error ? error.message : error };
                }
                res.status(500).json(apiError);
            }
        };
        this.reloadAgents = async (req, res, next) => {
            try {
                const configs = await this.agentService.reloadAgents();
                res.json({
                    success: true,
                    message: '智能体配置已重新加载',
                    data: {
                        totalAgents: configs.length,
                        activeAgents: configs.filter(c => c.isActive).length,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                console.error('重新加载智能体配置失败:', error);
                const apiError = {
                    code: 'RELOAD_AGENTS_FAILED',
                    message: '重新加载智能体配置失败',
                    timestamp: new Date().toISOString(),
                };
                if (process.env.NODE_ENV === 'development') {
                    apiError.details = { error: error instanceof Error ? error.message : error };
                }
                res.status(500).json(apiError);
            }
        };
        this.validateAgent = async (req, res, next) => {
            try {
                const { id } = req.params;
                if (!id) {
                    const apiError = {
                        code: 'INVALID_AGENT_ID',
                        message: '智能体ID不能为空',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const isValid = await this.chatService.validateAgentConfig(id);
                const config = await this.agentService.getAgent(id);
                res.json({
                    success: true,
                    data: {
                        agentId: id,
                        isValid,
                        exists: !!config,
                        isActive: config?.isActive || false,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                console.error('验证智能体配置失败:', error);
                const apiError = {
                    code: 'VALIDATE_AGENT_FAILED',
                    message: '验证智能体配置失败',
                    timestamp: new Date().toISOString(),
                };
                if (process.env.NODE_ENV === 'development') {
                    apiError.details = { error: error instanceof Error ? error.message : error };
                }
                res.status(500).json(apiError);
            }
        };
        this.updateAgent = async (req, res, next) => {
            try {
                await ensureAdminAuth(req);
                const { id } = req.params;
                if (!id) {
                    res.status(400).json({ code: 'INVALID_AGENT_ID', message: '智能体ID不能为空', timestamp: new Date().toISOString() });
                    return;
                }
                const updatesRaw = req.body || {};
                const allowedKeys = new Set(['name', 'description', 'model', 'isActive', 'systemPrompt', 'temperature', 'maxTokens']);
                const updates = {};
                Object.keys(updatesRaw || {}).forEach((k) => { if (allowedKeys.has(k))
                    updates[k] = updatesRaw[k]; });
                await this.agentService.updateAgent(id, updates);
                const latest = await this.agentService.getAgent(id);
                res.json({ success: true, data: latest, timestamp: new Date().toISOString() });
            }
            catch (error) {
                console.error('更新智能体失败:', error);
                res.status(500).json({ code: 'UPDATE_AGENT_FAILED', message: '更新智能体失败', timestamp: new Date().toISOString() });
            }
        };
        this.agentService = new AgentConfigService_1.AgentConfigService();
        this.chatService = new ChatProxyService_1.ChatProxyService(this.agentService);
    }
}
exports.AgentController = AgentController;
//# sourceMappingURL=AgentController.js.map