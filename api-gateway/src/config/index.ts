import dotenv from 'dotenv';

dotenv.config();

function loadJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  // 安全：生产环境必须显式配置强随机密钥，拒绝用默认值/空值启动
  if (process.env.NODE_ENV === 'production' && (!secret || secret === 'your-secret-key')) {
    throw new Error('生产环境必须设置环境变量 JWT_SECRET（当前为默认值或空，拒绝启动）');
  }
  return secret || 'your-secret-key';
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    file: process.env.DATABASE_FILE || './data/store-ledger.db',
  },
  jwt: {
    secret: loadJwtSecret(),
    expiresIn: '24h',
  },
};