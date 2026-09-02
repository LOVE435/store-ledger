export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
      <div className="rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">{message}</div>
    </div>
  );
}
