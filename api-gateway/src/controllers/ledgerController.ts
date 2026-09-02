import { Router, Request, Response, NextFunction } from 'express';
import { ledgerService } from '../services/ledgerService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { isValidEntity } from '../models/LedgerItem';
import { AppError } from '../utils/AppError';
import { broadcastToOwner } from '../utils/websocket';

const router = Router();

/** 全部业务数据接口都需要登录，owner 取 token 内用户 id（一账号一店一账本） */
router.use(authMiddleware);

/** GET /api/ledger/:entity?since=ISO —— 拉取数据。不带 since 拉全量，带 since 拉增量 */
router.get('/:entity', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entity = String(req.params.entity);
    if (!isValidEntity(entity)) throw new AppError(`不支持的实体类型: ${entity}`, 400);
    const since = typeof req.query.since === 'string' && req.query.since ? req.query.since : undefined;
    const items = since
      ? await ledgerService.listChangesSince(req.user!.id, entity, since)
      : await ledgerService.listByOwner(req.user!.id, entity);
    const maxUpdatedAt = await ledgerService.maxUpdatedAt(req.user!.id, entity);
    res.json({
      status: 'success',
      data: {
        entity,
        items: items.map((i) => i.toJSON()),
        maxUpdatedAt,
        full: !since,
      },
      message: 'OK',
    });
  } catch (error) {
    next(error);
  }
});

/** PUT /api/ledger/:entity/:id —— upsert 单行（body 为前端完整对象） */
router.put('/:entity/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entity = String(req.params.entity);
    const id = String(req.params.id);
    const item = await ledgerService.upsert(req.user!.id, entity, id, req.body ?? {});
    broadcastToOwner(req.user!.id, 'ledger-update', {
      entity: item.entity,
      action: 'upsert',
      id: item.id,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
    });
    res.json({ status: 'success', data: item.toJSON(), message: '已保存' });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/ledger/:entity/:id —— 软删除（墓碑），可被同步传播 */
router.delete('/:entity/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entity = String(req.params.entity);
    const id = String(req.params.id);
    const item = await ledgerService.softDelete(req.user!.id, entity, id);
    if (!item) throw new AppError('数据不存在', 404);
    broadcastToOwner(req.user!.id, 'ledger-update', {
      entity: item.entity,
      action: 'delete',
      id: item.id,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
    });
    res.json({ status: 'success', data: item.toJSON(), message: '已删除' });
  } catch (error) {
    next(error);
  }
});

export default router;
export { router as ledgerRouter };
