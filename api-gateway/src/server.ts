import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './controllers/authController';
import ledgerRoutes from './controllers/ledgerController';
import syncRoutes from './controllers/syncController';
import imageRoutes from './controllers/imageController';
import { initWebSocket } from './utils/websocket';
import { initUploads } from './services/imageService';
import { config } from './config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: Number(process.env.RATE_LIMIT_MAX) || 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { status: 'error', message: 'Too many requests, please slow down', data: null },
    })
  );
}

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/images', imageRoutes);

// 图片静态访问（/uploads/<name>）
initUploads();
app.use('/uploads', express.static(path.resolve(__dirname, '../data/uploads'), { maxAge: '365d' }));

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  fs.mkdirSync(path.dirname(config.database.file), { recursive: true });

  const server = http.createServer(app);
  initWebSocket(server);
  server.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

export default app;