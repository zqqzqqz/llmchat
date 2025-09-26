import { AuthService } from '@/services/AuthService';

// 全局单例的鉴权服务，确保各控制器共享同一份内存 token 存储
export const authService = new AuthService();

