import { Router } from 'express';
import { AgentController } from '@/controllers/AgentController';

const router = Router();
const agentController = new AgentController();

// 获取可用智能体列表
// GET /api/agents
// 查询参数: includeInactive=true 包含不可用的智能体
router.get('/', agentController.getAgents);

// 重新加载智能体配置
// POST /api/agents/reload
router.post('/reload', agentController.reloadAgents);

// 获取特定智能体信息
// GET /api/agents/:id
router.get('/:id', agentController.getAgent);

// 检查智能体状态
// GET /api/agents/:id/status
router.get('/:id/status', agentController.getAgentStatus);

// 验证智能体配置
// GET /api/agents/:id/validate
router.get('/:id/validate', agentController.validateAgent);

export { router as agentRoutes };