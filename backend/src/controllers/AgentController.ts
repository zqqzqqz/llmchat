import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

import { AgentConfigService } from '@/services/AgentConfigService';
import { ChatProxyService } from '@/services/ChatProxyService';
import { ApiError, AgentConfig } from '@/types';
import { authService } from '@/services/authInstance';
async function ensureAdminAuth(req: Request) {
  const auth = req.headers['authorization'];
  const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('UNAUTHORIZED');
  const user = await authService.profile(token);
  if (!user || user.role !== 'admin') throw new Error('UNAUTHORIZED');
  return user;
}

function handleAdminAuthError(error: unknown, res: Response): boolean {
  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    res.status(403).json({
      code: 'UNAUTHORIZED',
      message: '需要管理员权限',
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

/**
 * 智能体控制器
 */
export class AgentController {
  private agentService: AgentConfigService;
  private chatService: ChatProxyService;
  private createAgentSchema = Joi.object({
    id: Joi.string().optional(),
    name: Joi.string().max(120).required(),
    description: Joi.string().allow('').default(''),
    provider: Joi.string().valid('fastgpt', 'openai', 'anthropic', 'custom').required(),
    endpoint: Joi.string().uri({ allowRelative: false }).required(),
    apiKey: Joi.string().required(),
    appId: Joi.string().optional(),
    model: Joi.string().max(120).required(),
    maxTokens: Joi.number().min(1).max(32768).optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    systemPrompt: Joi.string().allow('').optional(),
    capabilities: Joi.array().items(Joi.string()).default([]),
    rateLimit: Joi.object({
      requestsPerMinute: Joi.number().min(0).optional(),
      tokensPerMinute: Joi.number().min(0).optional(),
    }).optional(),
    isActive: Joi.boolean().optional(),
    features: Joi.object({
      supportsChatId: Joi.boolean().optional(),
      supportsStream: Joi.boolean().optional(),
      supportsDetail: Joi.boolean().optional(),
      supportsFiles: Joi.boolean().optional(),
      supportsImages: Joi.boolean().optional(),
      streamingConfig: Joi.object({
        enabled: Joi.boolean().optional(),
        endpoint: Joi.string().valid('same', 'different').optional(),
        statusEvents: Joi.boolean().optional(),
        flowNodeStatus: Joi.boolean().optional(),
      }).optional(),
    }).optional(),
  });
  private updateAgentSchema = Joi.object({
    name: Joi.string().max(120).optional(),
    description: Joi.string().allow('').optional(),
    provider: Joi.string().valid('fastgpt', 'openai', 'anthropic', 'custom').optional(),
    endpoint: Joi.string().uri({ allowRelative: false }).optional(),
    apiKey: Joi.string().optional(),
    appId: Joi.string().optional(),
    model: Joi.string().max(120).optional(),
    maxTokens: Joi.number().min(1).max(32768).optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    systemPrompt: Joi.string().allow('').optional(),
    capabilities: Joi.array().items(Joi.string()).optional(),
    rateLimit: Joi.object({
      requestsPerMinute: Joi.number().min(0).optional(),
      tokensPerMinute: Joi.number().min(0).optional(),
    }).optional(),
    isActive: Joi.boolean().optional(),
    features: Joi.object({
      supportsChatId: Joi.boolean().optional(),
      supportsStream: Joi.boolean().optional(),
      supportsDetail: Joi.boolean().optional(),
      supportsFiles: Joi.boolean().optional(),
      supportsImages: Joi.boolean().optional(),
      streamingConfig: Joi.object({
        enabled: Joi.boolean().optional(),
        endpoint: Joi.string().valid('same', 'different').optional(),
        statusEvents: Joi.boolean().optional(),
        flowNodeStatus: Joi.boolean().optional(),
      }).optional(),
    }).optional(),
  });
  private importSchema = Joi.object({
    agents: Joi.array().items(this.createAgentSchema).min(1).required(),
  });

  constructor() {
    this.agentService = new AgentConfigService();
    this.chatService = new ChatProxyService(this.agentService);
  }

  /**
   * 获取可用智能体列表
   * GET /api/agents
   */
  getAgents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    } catch (error) {
      console.error('获取智能体列表失败:', error);
      const apiError: ApiError = {
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

  /**
   * 获取特定智能体信息
   * GET /api/agents/:id
   */
  getAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        const apiError: ApiError = {
          code: 'INVALID_AGENT_ID',
          message: '智能体ID不能为空',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const config = await this.agentService.getAgent(id);

      if (!config) {
        const apiError: ApiError = {
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${id}`,
          timestamp: new Date().toISOString(),
        };
        res.status(404).json(apiError);
        return;
      }

      // 转换为安全的Agent对象（不包含敏感信息）
      const agent = this.toSafeAgent(config);

      res.json({
        success: true,
        data: agent,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('获取智能体信息失败:', error);
      const apiError: ApiError = {
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

  createAgent = async (req: Request, res: Response): Promise<void> => {
    try {
      await ensureAdminAuth(req);
      const { error, value } = this.createAgentSchema.validate(req.body, { abortEarly: false });
      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join('; '),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const created = await this.agentService.createAgent(value);
      res.status(201).json({
        success: true,
        data: this.toSafeAgent(created),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (handleAdminAuthError(error, res)) {
        return;
      }
      console.error('创建智能体失败:', error);
      res.status(500).json({
        code: 'CREATE_AGENT_FAILED',
        message: '创建智能体失败',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * 检查智能体状态
   * GET /api/agents/:id/status
   */
  getAgentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        const apiError: ApiError = {
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
    } catch (error) {
      console.error('检查智能体状态失败:', error);
      const apiError: ApiError = {
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

  /**
   * 重新加载智能体配置
   * POST /api/agents/reload
   */
  reloadAgents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ensureAdminAuth(req);
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
    } catch (error) {
      if (handleAdminAuthError(error, res)) {
        return;
      }
      console.error('重新加载智能体配置失败:', error);
      const apiError: ApiError = {
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

  /**
   * 验证智能体配置
   * GET /api/agents/:id/validate
   */
  validateAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        const apiError: ApiError = {
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
    } catch (error) {
      console.error('验证智能体配置失败:', error);

      const apiError: ApiError = {
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

  /**
   * 更新智能体配置（启用/禁用、编辑）
   * POST /api/agents/:id/update
   */
  updateAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ensureAdminAuth(req);
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ code: 'INVALID_AGENT_ID', message: '智能体ID不能为空', timestamp: new Date().toISOString() });
        return;
      }
      const { error, value } = this.updateAgentSchema.validate(req.body || {}, { abortEarly: false });
      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join('; '),
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await this.agentService.updateAgent(id, value as Partial<AgentConfig>);
      const latest = await this.agentService.getAgent(id);
      res.json({
        success: true,
        data: latest ? this.toSafeAgent(latest) : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (handleAdminAuthError(error, res)) {
        return;
      }
      console.error('更新智能体失败:', error);
      res.status(500).json({ code: 'UPDATE_AGENT_FAILED', message: '更新智能体失败', timestamp: new Date().toISOString() });
    }
  };

  deleteAgent = async (req: Request, res: Response): Promise<void> => {
    try {
      await ensureAdminAuth(req);
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          code: 'INVALID_AGENT_ID',
          message: '智能体ID不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      await this.agentService.deleteAgent(id);
      res.json({ success: true, data: null, timestamp: new Date().toISOString() });
    } catch (error) {
      if (handleAdminAuthError(error, res)) {
        return;
      }
      console.error('删除智能体失败:', error);
      res.status(500).json({ code: 'DELETE_AGENT_FAILED', message: '删除智能体失败', timestamp: new Date().toISOString() });
    }
  };

  importAgents = async (req: Request, res: Response): Promise<void> => {
    try {
      await ensureAdminAuth(req);
      const { error, value } = this.importSchema.validate(req.body, { abortEarly: false });
      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join('; '),
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const agents = await this.agentService.importAgents(value.agents);
      res.json({
        success: true,
        data: agents.map((agent) => this.toSafeAgent(agent)),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (handleAdminAuthError(error, res)) {
        return;
      }
      console.error('导入智能体失败:', error);
      res.status(500).json({ code: 'IMPORT_AGENT_FAILED', message: '导入智能体失败', timestamp: new Date().toISOString() });
    }
  };

  private toSafeAgent(config: AgentConfig) {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      endpoint: config.endpoint,
      model: config.model,
      status: config.isActive ? 'active' : 'inactive',
      capabilities: config.capabilities,
      provider: config.provider,
      features: config.features,
      rateLimit: config.rateLimit,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      appId: config.appId,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

}