import { Router, Request, Response, NextFunction } from 'express';
import { syncService } from '../services/syncService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { broadcastToOwner } from '../utils/websocket';

const router = Router();

router.use(authMiddleware);

/**
 * POST /api/sync/push —— 批量上行（LWW）。
 * body: { items: [{ entity: 'client'|'record', id, data?, updatedAt?, deletedAt? }] }
 * 返回每项 applied / server(冲突时回传服务端较新版本)
 */
router.post('/push', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const results = await syncService.push(req.user!.id, items);
    // 通知同账号其它在线设备有新变化（拉取由客户端触发）
    const changed = results.filter((r) => r.applied);
    if (changed.length > 0) {
      broadcastToOwner(req.user!.id, 'sync-changed', { count: changed.length });
    }
    res.json({ status: 'success', data: { results }, message: '同步完成' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sync/pull —— 批量下行（增量）。
 * body: { clientSince?, recordSince? } ISO 时间，缺省表示全量。
 */
router.post('/pull', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = (req.body ?? {}) as { clientSince?: string; recordSince?: string };
    const data = await syncService.pull(req.user!.id, {
      clientSince: typeof body.clientSince === 'string' && body.clientSince ? body.clientSince : undefined,
      recordSince: typeof body.recordSince === 'string' && body.recordSince ? body.recordSince : undefined,
    });
    res.json({ status: 'success', data, message: 'OK' });
  } catch (error) {
    next(error);
  }
});

export default router;
