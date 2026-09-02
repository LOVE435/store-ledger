import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import { deleteLocal } from '../lib/sync';
import type { Client } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

export default function ClientFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const client = useLiveQuery(() => (id ? db.clients.get(id) : undefined), [id]);
  const clients = useLiveQuery(() => db.clients.toArray(), []) ?? [];

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [phone, setPhone] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setName(client.name);
    setLocation(client.location);
    setWechatId(client.wechatId);
    setPhone(client.phone);
  }, [client]);

  const handleSave = async () => {
    const n = name.trim();
    if (!n) {
      setMsg('请填写客户名');
      return;
    }
    const dup = clients.find((c) => c.name.trim() === n && c.id !== id);
    if (dup) {
      setMsg('客户名已存在，请换一个');
      return;
    }
    const payload: Client = {
      id: isEdit && id ? id : uid(),
      name: n,
      location: location.trim(),
      wechatId: wechatId.trim(),
      phone: phone.trim(),
      createdAt: client?.createdAt ?? new Date().toISOString(),
    };
    if (isEdit && id) {
      await db.clients.update(id, payload);
    } else {
      await db.clients.add(payload);
    }
    navigate('/clients');
  };

  const handleDelete = async () => {
    if (id) await deleteLocal('client', id);
    navigate('/clients');
  };

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2.5';

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-teal-700">
          ← 返回
        </button>
        <h1 className="text-lg font-bold">{isEdit ? '编辑客户' : '新增客户'}</h1>
        <span className="w-10" />
      </header>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            客户名 <span className="text-red-500">*</span>
          </label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="客户名称" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">所在地</label>
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="如：广州、杭州" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">微信号</label>
          <input className={inputCls} value={wechatId} onChange={(e) => setWechatId(e.target.value)} placeholder="填了才能一键跳转微信聊天" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">手机号</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="选填" inputMode="tel" />
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          className="w-full rounded-xl bg-teal-700 py-3 text-base font-bold text-white active:bg-teal-800"
        >
          保存
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="w-full rounded-xl py-2 text-sm font-medium text-red-600"
          >
            删除客户（已有账目保留）
          </button>
        )}
      </section>

      <ConfirmDialog
        open={deleteOpen}
        title="删除客户"
        message="删除客户后，已有账目仍会保留（客户名快照）。确定删除吗？"
        confirmText="删除"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
      <Toast message={msg} />
    </div>
  );
}
