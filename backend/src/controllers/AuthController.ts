import { Request, Response } from 'express';
import { authService } from '@/services/authInstance';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'username/password 必填',
          timestamp: new Date().toISOString(),
        });
      }
      const result = await authService.login(username, password);
      return res.json(result);
    } catch (e: any) {
      if (e?.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: '用户名或密码错误',
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: '登录失败',
        details: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async profile(req: Request, res: Response) {
    try {
      const auth = req.headers['authorization'];
      const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '缺少令牌', timestamp: new Date().toISOString() });
      }
      const user = await authService.profile(token);
      return res.json({ user });
    } catch (e: any) {
      const code = e?.message === 'TOKEN_EXPIRED' ? 401 : 401;
      return res.status(code).json({
        code: 'UNAUTHORIZED',
        message: e instanceof Error ? e.message : '未授权',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const auth = req.headers['authorization'];
      const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
      if (token) await authService.logout(token);
      return res.json({ ok: true });
    } catch (e) {
      return res.json({ ok: true });
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const auth = req.headers['authorization'];
      const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return res.status(401).json({ code: 'UNAUTHORIZED', message: '缺少令牌', timestamp: new Date().toISOString() });
      const { oldPassword, newPassword } = req.body || {};
      if (!oldPassword || !newPassword) return res.status(400).json({ code: 'BAD_REQUEST', message: 'oldPassword/newPassword 必填', timestamp: new Date().toISOString() });
      await authService.changePassword(token, oldPassword, newPassword);
      return res.json({ ok: true });
    } catch (e: any) {
      const msg = e?.message;
      if (msg === 'UNAUTHORIZED' || msg === 'TOKEN_EXPIRED') {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
      }
      if (msg === 'INVALID_OLD_PASSWORD') {
        return res.status(400).json({ code: 'INVALID_OLD_PASSWORD', message: '原密码不正确', timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ code: 'INTERNAL_ERROR', message: '修改密码失败', timestamp: new Date().toISOString() });
    }
  }
}

