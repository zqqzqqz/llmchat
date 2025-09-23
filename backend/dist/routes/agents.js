"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRoutes = void 0;
const express_1 = require("express");
const AgentController_1 = require("@/controllers/AgentController");
const router = (0, express_1.Router)();
exports.agentRoutes = router;
const agentController = new AgentController_1.AgentController();
router.get('/', agentController.getAgents);
router.post('/reload', agentController.reloadAgents);
router.get('/:id', agentController.getAgent);
router.get('/:id/status', agentController.getAgentStatus);
router.get('/:id/validate', agentController.validateAgent);
//# sourceMappingURL=agents.js.map