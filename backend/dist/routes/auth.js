"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const AuthController_1 = require("@/controllers/AuthController");
exports.authRoutes = (0, express_1.Router)();
exports.authRoutes.post('/login', AuthController_1.AuthController.login);
exports.authRoutes.get('/profile', AuthController_1.AuthController.profile);
exports.authRoutes.post('/logout', AuthController_1.AuthController.logout);
exports.authRoutes.post('/change-password', AuthController_1.AuthController.changePassword);
//# sourceMappingURL=auth.js.map