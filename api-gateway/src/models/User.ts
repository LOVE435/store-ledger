/**
 * 用户模型。password_hash 永不出现在对外响应中。
 */
export interface UserRow {
  id: number;
  username: string;
  password_hash?: string;
  created_at: string;
}

/** 对外返回的安全用户信息 */
export interface PublicUser {
  id: number;
  username: string;
  createdAt: string;
}

export class User {
  id: number;
  username: string;
  createdAt: string;

  constructor(data: UserRow) {
    this.id = Number(data.id);
    this.username = data.username || '';
    this.createdAt = data.created_at || new Date().toISOString();
  }

  toJSON(): PublicUser {
    return { id: this.id, username: this.username, createdAt: this.createdAt };
  }
}
