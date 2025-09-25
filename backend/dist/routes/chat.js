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
router.get('/history/:sessionId', chatController.getChatHistory);
router.post('/feedback', chatController.updateUserFeedback);
//# sourceMappingURL=chat.js.map