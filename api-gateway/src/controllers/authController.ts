import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/** POST /api/auth/register  注册新账号，返回 token + 用户信息 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body ?? {};
    const result = await authService.register(String(username ?? ''), String(password ?? ''));
    res.status(201).json({ status: 'success', data: result, message: '注册成功' });
  } catch (error) {
    next(error);
  }
});

/** POST /api/auth/login  登录，返回 token + 用户信息 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body ?? {};
    const result = await authService.login(String(username ?? ''), String(password ?? ''));
    res.json({ status: 'success', data: result, message: '登录成功' });
  } catch (error) {
    next(error);
  }
});

/** GET /api/auth/me  返回当前登录用户信息（需 Bearer token） */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const fresh = await authService.getUserById(user.id);
    if (!fresh) {
      res.status(401).json({ status: 'error', message: '用户不存在', data: null });
      return;
    }
    res.json({ status: 'success', data: { user: fresh }, message: 'OK' });
  } catch (error) {
    next(error);
  }
});

export default router;
