"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const AdminController_1 = require("@/controllers/AdminController");
exports.adminRoutes = (0, express_1.Router)();
exports.adminRoutes.get('/system-info', AdminController_1.AdminController.systemInfo);
exports.adminRoutes.get('/users', AdminController_1.AdminController.users);
exports.adminRoutes.get('/logs', AdminController_1.AdminController.logs);
exports.adminRoutes.get('/logs/export', AdminController_1.AdminController.logsExport);
//# sourceMappingURL=admin.js.map