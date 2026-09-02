import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { activeRecordsQuery, db } from '../db';
import {
  buildBackupJson,
  buildCsv,
  exportFile,
  parseBackupJson,
  readFileAsText,
  type BackupFile,
} from '../lib/backup';
import { today } from '../lib/analysis';
import { useAuth } from '../lib/auth';
import { syncAll } from '../lib/sync';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

export default function SettingsPage() {
  const clients = useLiveQuery(() => db.clients.toArray(), []) ?? [];
  const records = useLiveQuery(() => activeRecordsQuery(), []) ?? [];
  const allRecords = useLiveQuery(() => db.records.toArray(), []) ?? [];
  const deletedCount = useLiveQuery(() => db.records.filter((r) => !!r.deletedAt).count(), []) ?? 0;
  const [importData, setImportData] = useState<BackupFile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const stamp = today();

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const r = await syncAll();
      setMsg(`同步完成：上行 ${r.push.pushed} 条，拉取 ${r.pull.pulled} 条`);
    } catch (err) {
      setMsg(`同步失败：${err instanceof Error ? err.message : '网络错误'}`);
    } finally {
      setSyncing(false);
    }
  };

  const doLogout = () => {
    logout();
    navigate('/');
  };

  const handleExportCsv = async () => {
    try {
      const path = await exportFile(`记账本-账目-${stamp}.csv`, buildCsv(records), 'text/csv;charset=utf-8');
      setMsg(`CSV 已导出（${records.length} 笔）`);
      void path;
    } catch {
      setMsg('导出失败，请重试');
    }
  };

  const handleExportJson = async () => {
    try {
      await exportFile(`记账本-备份-${stamp}.json`, buildBackupJson(clients, allRecords), 'application/json');
      setMsg(`备份已导出（${clients.length} 位客户、${allRecords.length} 笔账目，含回收站）`);
    } catch {
      setMsg('导出失败，请重试');
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const data = parseBackupJson(text);
      setImportData(data);
    } catch {
      setMsg('备份文件格式不正确');
    }
  };

  const doImport = async () => {
    if (!importData) return;
    await db.clients.bulkPut(importData.clients);
    await db.records.bulkPut(importData.records);
    setMsg(`导入成功：${importData.clients.length} 位客户、${importData.records.length} 笔账目`);
    setImportData(null);
  };

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">设置</h1>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium">我的账号</p>
          <p className="mt-0.5 text-xs text-slate-400">
            登录中：<b className="text-teal-700">{user?.username}</b>
            （同账号多台手机数据实时互通）
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={syncing}
            className="flex-1 rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {syncing ? '同步中…' : '立即同步'}
          </button>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex-1 rounded-lg border border-red-300 py-2.5 text-sm font-semibold text-red-600"
          >
            退出登录
          </button>
        </div>
        <p className="text-xs text-slate-400">
          已开启实时同步：本机改动自动上传，同账号其它设备的改动几秒内自动出现。
        </p>
      </section>

      <section className="mt-4 space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">币种显示</p>
            <p className="text-xs text-slate-400">人民币 ¥</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">¥</span>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-sm font-medium">备份与恢复</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={records.length === 0}
              className="rounded-lg border border-teal-600 py-2.5 text-sm font-semibold text-teal-700 disabled:opacity-40"
            >
              导出 CSV（Excel）
            </button>
            <button
              type="button"
              onClick={() => void handleExportJson()}
              className="rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white"
            >
              导出 JSON 备份
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600"
          >
            导入 JSON 备份恢复
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
        <p className="font-semibold text-slate-700">关于</p>
        <p className="mt-2 leading-relaxed">
          记账本 v1.1.0
          <br />
          多设备云同步版：登录后本机数据自动与账号云端双向同步。
          <br />
          微信跳转依赖微信版本支持，失败时可复制后手动搜索。
        </p>
      </section>

      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <Link
          to="/recycle-bin"
          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3"
        >
          <span className="text-sm font-medium text-slate-700">🗑 回收站</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {deletedCount} 条
          </span>
        </Link>
      </section>

      <ConfirmDialog
        open={importData !== null}
        title="导入备份"
        message={
          importData
            ? `将导入 ${importData.clients.length} 位客户、${importData.records.length} 笔账目。同 id 的数据会被覆盖，确定继续吗？`
            : ''
        }
        confirmText="导入"
        onConfirm={() => void doImport()}
        onCancel={() => setImportData(null)}
      />
      <ConfirmDialog
        open={logoutOpen}
        title="退出登录"
        message="退出后本机不再自动同步。数据仍保留在云端与手机本地，重新登录即可继续使用。确定退出吗？"
        confirmText="退出"
        danger
        onConfirm={() => void doLogout()}
        onCancel={() => setLogoutOpen(false)}
      />
      <Toast message={msg} />
    </div>
  );
}
