/**
 * 云同步 API 客户端（正式版）。
 * 与 api-gateway 后端对接：认证 + 批量增量同步 + 图片上传。
 *
 * 服务器地址在构建时通过 VITE_API_URL 注入并固定（打进安装包），
 * 不向用户暴露，也不允许运行时修改。
 */

const TOKEN_KEY = 'ledger_token';
const USER_KEY = 'ledger_user';

const DEFAULT_API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

export function getApiUrl(): string {
  return DEFAULT_API_URL;
}

export interface AuthUser {
  id: number;
  username: string;
  createdAt: string;
}

export interface Session {
  token: string;
  user: AuthUser;
}

export function loadSession(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    return { token, user: JSON.parse(raw) as AuthUser };
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    localStorage.setItem(TOKEN_KEY, s.token);
    localStorage.setItem(USER_KEY, JSON.stringify(s.user));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const t = token !== undefined ? token : loadSession()?.token;
  if (t) headers.Authorization = `Bearer ${t}`;

  const response = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    /* non-json */
  }
  if (!response.ok || (body && body.status === 'error')) {
    const msg = body?.message || `请求失败: HTTP ${response.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  if (!body) throw new Error(`服务器无响应: HTTP ${response.status}`);
  return body.data;
}

/* ---------------- 认证 ---------------- */

export async function apiRegister(username: string, password: string): Promise<Session> {
  return request<Session>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }, null);
}

export async function apiLogin(username: string, password: string): Promise<Session> {
  return request<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }, null);
}

export async function apiMe(token: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/api/auth/me', { method: 'GET' }, token);
}

/* ---------------- 同步 ---------------- */

export interface SyncPushItem {
  entity: 'client' | 'record';
  id: string;
  data?: Record<string, unknown>;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface SyncPushResult {
  entity: string;
  id: string;
  applied: boolean;
  server: Record<string, unknown> | null;
}

export async function apiSyncPush(items: SyncPushItem[]): Promise<{ results: SyncPushResult[] }> {
  return request<{ results: SyncPushResult[] }>(
    '/api/sync/push',
    { method: 'POST', body: JSON.stringify({ items }) }
  );
}

export async function apiSyncPull(params: { clientSince?: string; recordSince?: string }) {
  return request<{
    client: { items: Record<string, unknown>[]; maxUpdatedAt: string };
    record: { items: Record<string, unknown>[]; maxUpdatedAt: string };
  }>('/api/sync/pull', { method: 'POST', body: JSON.stringify(params) });
}

/* ---------------- 图片上传 ---------------- */

export interface UploadResult {
  url: string;
  mime: string;
  size: number;
}

export async function apiUploadImage(dataUrl: string): Promise<UploadResult> {
  return request<UploadResult>('/api/images', { method: 'POST', body: JSON.stringify({ dataUrl }) });
}

/** 拼完整图片地址（dataURL 原样返回，相对路径拼服务器地址） */
export function resolveImageUrl(src: string): string {
  if (!src) return src;
  if (/^data:/i.test(src) || /^https?:\/\//i.test(src)) return src;
  return `${getApiUrl()}${src.startsWith('/') ? '' : '/'}${src}`;
}
