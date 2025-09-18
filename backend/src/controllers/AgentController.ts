import { Request, Response, NextFunction } from 'express';
import { AgentConfigService } from '@/services/AgentConfigService';
import { ChatProxyService } from '@/services/ChatProxyService';
import { ApiError } from '@/types';

/**
 * 智能体控制器
 */
export class AgentController {
  private agentService: AgentConfigService;
  private chatService: ChatProxyService;

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
}