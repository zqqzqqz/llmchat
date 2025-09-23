import { Router } from 'express';
import { ChatController } from '@/controllers/ChatController';

const router = Router();
const chatController = new ChatController();

// 发送聊天请求（支持流式和非流式）
// POST /api/chat/completions
router.post('/completions', chatController.chatCompletions);

// 聊天初始化路由
router.get('/init', chatController.chatInit);

// 获取聊天历史
// GET /api/chat/history/:sessionId
router.get('/history/:sessionId', chatController.getChatHistory);

export { router as chatRoutes };