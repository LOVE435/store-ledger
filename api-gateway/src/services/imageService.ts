import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../utils/AppError';
import { config } from '../config';

/** 允许的图片 MIME -> 扩展名 */
const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const UPLOADS_DIR = path.resolve(__dirname, '../../data/uploads');

function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * 上传一张 dataURL 图片（"data:image/jpeg;base64,..."），落盘并返回相对 URL。
 * @returns { url, mime, size }
 */
export function saveImage(dataUrl: string): { url: string; mime: string; size: number } {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl || '');
  if (!match) {
    throw new AppError('图片格式不支持（需 jpeg/png/webp/gif 的 dataURL）', 400);
  }
  const mime = match[1];
  const ext = MIME_EXT[mime] || '.bin';
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB 单图上限
  if (buffer.byteLength === 0) {
    throw new AppError('图片内容为空', 400);
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new AppError('图片过大（超过 15MB）', 413);
  }
  ensureUploadsDir();
  const name = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
  return { url: `/uploads/${name}`, mime, size: buffer.byteLength };
}

/** 初始化上传目录（服务启动时调用） */
export function initUploads(): void {
  ensureUploadsDir();
}
