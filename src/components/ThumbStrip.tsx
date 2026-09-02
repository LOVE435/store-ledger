import { useState } from 'react';
import { resolveImageUrl } from '../lib/cloud';

export default function ThumbStrip({ images }: { images: string[] }) {
  const [view, setView] = useState<string | null>(null);
  if (images.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setView(resolveImageUrl(src));
            }}
            className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 active:opacity-70"
          >
            <img src={resolveImageUrl(src)} alt={`图片${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {view && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setView(null)}
        >
          <img src={view} alt="图片预览" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}
