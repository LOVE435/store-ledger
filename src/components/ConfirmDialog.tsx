interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white ${
              danger ? 'bg-red-600' : 'bg-teal-700'
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
