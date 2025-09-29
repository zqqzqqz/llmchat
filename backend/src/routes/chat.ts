import { Router } from 'express';
import { ChatController } from '@/controllers/ChatController';

const router = Router();
const chatController = new ChatController();

// 发送聊天请求（支持流式和非流式）
// POST /api/chat/completions
router.post('/completions', chatController.chatCompletions);

// 聊天初始化路由
router.get('/init', chatController.chatInit);

// 获取聊天历史列表 & 详情
router.get('/history', chatController.listChatHistories);
router.get('/history/:chatId', chatController.getChatHistory);

// 删除/清空聊天历史
router.delete('/history/:chatId', chatController.deleteChatHistory);
router.delete('/history', chatController.clearChatHistories);

// 重新生成指定消息
router.post('/history/:chatId/retry', chatController.retryChatMessage);

// 点赞/点踩反馈
// POST /api/chat/feedback
router.post('/feedback', chatController.updateUserFeedback);

export { router as chatRoutes };
