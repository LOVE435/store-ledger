export default function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
      <span className="text-4xl">🗂️</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}
