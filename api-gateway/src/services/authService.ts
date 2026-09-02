import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Database } from '../config/database';
import { config } from '../config';
import { User, type PublicUser, type UserRow } from '../models/User';
import { AppError } from '../utils/AppError';

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface TokenPayload {
  id: number;
  username: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_\-\u4e00-\u9fa5]{2,30}$/;

export class AuthService {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  async register(username: string, password: string): Promise<AuthResult> {
    const name = (username || '').trim();
    if (!USERNAME_RE.test(name)) {
      throw new AppError('用户名需为 2-30 位字母、数字、下划线、连字符或中文', 400);
    }
    if (!password || password.length < 6) {
      throw new AppError('密码至少 6 位', 400);
    }

    const existing = await this.db.query('SELECT id FROM users WHERE username = $1', [name]);
    if (existing.rows.length > 0) {
      throw new AppError('用户名已被注册', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await this.db.query(
      'INSERT INTO users (username, password_hash, created_at) VALUES ($1, $2, datetime(\'now\')) RETURNING *',
      [name, passwordHash]
    );
    const user = new User(result.rows[0] as UserRow);
    return { token: this.signToken(user.id, user.username), user: user.toJSON() };
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const name = (username || '').trim();
    const result = await this.db.query('SELECT * FROM users WHERE username = $1', [name]);
    const row = result.rows[0] as UserRow | undefined;
    if (!row || !row.password_hash) {
      throw new AppError('用户名或密码错误', 401);
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      throw new AppError('用户名或密码错误', 401);
    }
    const user = new User(row);
    return { token: this.signToken(user.id, user.username), user: user.toJSON() };
  }

  async getUserById(id: number): Promise<PublicUser | null> {
    const result = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0] as UserRow).toJSON();
  }

  signToken(id: number, username: string): string {
    const payload: TokenPayload = { id, username };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
