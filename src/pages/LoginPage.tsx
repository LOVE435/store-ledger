import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { syncAll } from '../lib/sync';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = username.trim();
    if (!name) return setMsg('请输入用户名（一家店一个账号）');
    if (!password) return setMsg('请输入密码');
    setMsg(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(name, password);
        setMsg('注册成功！首次登录会自动把本机已有账目合并上传。');
      } else {
        await login(name, password);
        setMsg('登录成功');
      }
      // 登录后立即双向同步一次：本机旧账(若有)合并上传 + 拉取云端数据
      try {
        await syncAll();
      } catch {
        /* 同步失败不阻塞进入，状态栏会提示 */
      }
      // 成功后面板由 App 依据 session 自动切换
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '操作失败，请检查网络后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-slate-100 p-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-teal-700">📒 记账本</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          一个账号 = 一家店。同账号可在多台手机同时登录，数据实时同步。
        </p>

        <div className="mt-5 flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMsg(null);
            }}
            className={`flex-1 rounded-md py-1.5 ${mode === 'login' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setMsg(null);
            }}
            className={`flex-1 rounded-md py-1.5 ${mode === 'register' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}
          >
            注册新账号
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">用户名（店名）</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="如：张记劳保店"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 6 位' : '输入密码'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            />
          </div>

          {msg && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-teal-700 py-3 text-base font-bold text-white active:bg-teal-800 disabled:opacity-50"
          >
            {busy ? '请稍候…' : mode === 'login' ? '登 录' : '注册并登录'}
          </button>

          {mode === 'login' && (
            <p className="text-center text-xs text-slate-400">没有账号？切到「注册新账号」，一个店注册一个即可。</p>
          )}
        </div>
      </div>
    </div>
  );
}
