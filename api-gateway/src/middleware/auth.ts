import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

export interface AuthRequest extends Request {
  user?: { id: number; username: string };
}

/**
 * 校验 Authorization: Bearer <token>，通过后将 { id, username } 挂到 req.user。
 * 失败统一返回 401，不区分「无 token」与「token 无效」。
 */
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ status: 'error', message: '请先登录', data: null });
    return;
  }
  const payload = authService.verifyToken(token);
  if (!payload) {
    res.status(401).json({ status: 'error', message: '登录已失效，请重新登录', data: null });
    return;
  }
  req.user = { id: payload.id, username: payload.username };
  next();
};
