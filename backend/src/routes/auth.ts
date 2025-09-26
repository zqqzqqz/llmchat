import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';

export const authRoutes = Router();

authRoutes.post('/login', AuthController.login);
authRoutes.get('/profile', AuthController.profile);
authRoutes.post('/logout', AuthController.logout);
authRoutes.post('/change-password', AuthController.changePassword);

