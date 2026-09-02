import { useState } from 'react';
import type { Client } from '../types';
import { copyAndOpenWechat, openWechatChat } from '../lib/wechat';

type DialogState = 'missing' | 'fallback' | null;

export default function WechatButton({ client, onEdit }: { client: Client; onEdit?: () => void }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!client.wechatId.trim()) {
      setDialog('missing');
      return;
    }
    setBusy(true);
    const res = await openWechatChat(client.wechatId);
    setBusy(false);
    if (!res.ok) setDialog('fallback');
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#07c160] text-xs font-bold text-white active:opacity-80 disabled:opacity-50"
        title="打开微信聊天"
      >
        微
      </button>

      {dialog === 'missing' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-lg font-semibold">未填写微信号</h3>
            <p className="mt-2 text-sm text-slate-600">
              客户「{client.name}」还没有填写微信号，无法直接跳转聊天。可先补填微信号，或复制客户名后到微信里搜索。
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {onEdit && (
                <button
                  type="button"
                  className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white"
                  onClick={() => {
                    setDialog(null);
                    onEdit();
                  }}
                >
                  去补填微信号
                </button>
              )}
              <button
                type="button"
                className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
                onClick={async () => {
                  await copyAndOpenWechat(client.name);
                  setDialog(null);
                }}
              >
                复制客户名并打开微信
              </button>
              <button
                type="button"
                className="w-full rounded-lg py-2.5 text-sm text-slate-500"
                onClick={() => setDialog(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog === 'fallback' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-lg font-semibold">未能直接跳转</h3>
            <p className="mt-2 text-sm text-slate-600">
              当前微信版本可能不支持直接打开指定聊天。已为你复制微信号「{client.wechatId}」，打开微信后粘贴搜索即可。
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-lg bg-[#07c160] py-2.5 text-sm font-semibold text-white"
                onClick={async () => {
                  await copyAndOpenWechat(client.wechatId);
                  setDialog(null);
                }}
              >
                复制微信号并打开微信
              </button>
              <button
                type="button"
                className="w-full rounded-lg py-2.5 text-sm text-slate-500"
                onClick={() => setDialog(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
