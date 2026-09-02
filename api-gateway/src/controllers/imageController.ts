import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { saveImage } from '../services/imageService';

const router = Router();

router.use(authMiddleware);

/** POST /api/images —— 上传单张图片 dataURL，返回 { url }（相对路径 /uploads/xxx.jpg） */
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dataUrl = String((req.body ?? {}).dataUrl ?? '');
    const saved = saveImage(dataUrl);
    res.status(201).json({ status: 'success', data: saved, message: '上传成功' });
  } catch (error) {
    next(error);
  }
});

export default router;
