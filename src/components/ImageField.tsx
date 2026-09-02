import { useRef } from 'react';
import { readImageFile } from '../lib/images';
import { resolveImageUrl } from '../lib/cloud';

export default function ImageField({
  label,
  images,
  onChange,
}: {
  label: string;
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const added: string[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        added.push(await readImageFile(f));
      } catch {
        /* skip unreadable file */
      }
    }
    onChange([...images, ...added].slice(0, 9));
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white active:bg-teal-800"
        >
          + 添加图片
        </button>
      </div>
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={resolveImageUrl(src)} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white"
                aria-label="删除图片"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">支持拍照或从相册选择，最多 9 张</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
