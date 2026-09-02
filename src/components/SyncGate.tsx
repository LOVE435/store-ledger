import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { syncAll } from '../lib/sync';
import { connectSyncSocket, disconnectSyncSocket } from '../lib/realtime';

export type SyncState = {
  phase: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastAt: string | null;
  detail: string | null;
};

export default function SyncGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState<SyncState>({ phase: 'idle', lastAt: null, detail: null });

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let busy = false;

    const tick = async (source: string) => {
      if (cancelled || busy) return;
      busy = true;
      setState({ phase: 'syncing', lastAt: null, detail: `同步中…(${source})` });
      try {
        const r = await syncAll();
        if (!cancelled) {
          setState({
            phase: 'synced',
            lastAt: new Date().toISOString(),
            detail: `已同步（上行 ${r.push.pushed}，云端 ${r.pull.pulled}）`,
          });
        }
      } catch (e) {
        if (!cancelled) setState({ phase: 'error', lastAt: null, detail: e instanceof Error ? e.message : '同步失败' });
      } finally {
        busy = false;
      }
    };

    // 登录后先同步一次（首拉全量 + 本机旧账上传）
    void tick('登录');

    // WebSocket 实时通道：同账号其它设备有改动 → 立即同步
    connectSyncSocket(session.token, () => {
      void tick('实时');
    });

    // 周期兜底：本机离线改完恢复 / 服务器偶尔丢推送 / 本地写完自动上传
    const timer = window.setInterval(() => {
      void tick('定时');
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      disconnectSyncSocket();
    };
  }, [session]);

  return (
    <div className="min-h-full">
      <SyncBanner state={state} />
      {children}
    </div>
  );
}

export function SyncBanner({ state }: { state: SyncState }) {
  if (state.phase === 'synced') return null;
  const color =
    state.phase === 'syncing'
      ? 'bg-blue-500'
      : state.phase === 'error'
        ? 'bg-red-500'
        : state.phase === 'offline'
          ? 'bg-amber-500'
          : 'bg-slate-400';
  const text =
    state.phase === 'syncing'
      ? state.detail ?? '同步中…'
      : state.phase === 'error'
        ? state.detail ?? '同步失败，检查网络/服务器'
        : state.detail ?? '离线';
  return (
    <div className={`${color} px-4 py-1 text-center text-xs font-semibold text-white`}>{text}</div>
  );
}
