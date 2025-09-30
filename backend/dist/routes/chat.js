"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = void 0;
const express_1 = require("express");
const ChatController_1 = require("@/controllers/ChatController");
const router = (0, express_1.Router)();
exports.chatRoutes = router;
const chatController = new ChatController_1.ChatController();
router.post('/completions', chatController.chatCompletions);
router.get('/init', chatController.chatInit);
router.get('/history', chatController.listChatHistories);
router.get('/history/:chatId', chatController.getChatHistory);
router.delete('/history/:chatId', chatController.deleteChatHistory);
router.delete('/history', chatController.clearChatHistories);
router.post('/history/:chatId/retry', chatController.retryChatMessage);
router.post('/feedback', chatController.updateUserFeedback);
//# sourceMappingURL=chat.js.map