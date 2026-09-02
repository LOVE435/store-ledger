import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  loadSession,
  saveSession,
  clearSession,
  apiLogin,
  apiRegister,
  apiMe,
  type Session,
  type AuthUser,
} from './cloud';

interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  // 启动时校验 token 是否仍有效
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    apiMe(s.token)
      .then(() => setSession(s))
      .catch(() => {
        clearSession();
        setSession(null);
      });
  }, []);

  const apply = (s: Session) => {
    saveSession(s);
    setSession(s);
  };

  const login = async (username: string, password: string) => {
    apply(await apiLogin(username, password));
  };

  const register = async (username: string, password: string) => {
    apply(await apiRegister(username, password));
  };

  const logout = () => {
    clearSession();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  return ctx;
}
