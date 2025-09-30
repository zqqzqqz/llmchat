import { Router } from 'express';
import { AdminController } from '@/controllers/AdminController';

export const adminRoutes = Router();

adminRoutes.get('/system-info', AdminController.systemInfo);
adminRoutes.get('/users', AdminController.users);
adminRoutes.post('/users/create', AdminController.createUser);
adminRoutes.post('/users/update', AdminController.updateUser);
adminRoutes.post('/users/reset-password', AdminController.resetUserPassword);
adminRoutes.get('/logs', AdminController.logs);
adminRoutes.get('/logs/export', AdminController.logsExport);
adminRoutes.get('/analytics/province-heatmap', AdminController.provinceHeatmap);
adminRoutes.get('/analytics/conversations/series', AdminController.conversationSeries);
adminRoutes.get('/analytics/conversations/agents', AdminController.conversationAgents);

