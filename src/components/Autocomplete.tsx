import { useMemo, useState } from 'react';
import { suggest } from '../lib/analysis';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick?: (v: string) => void;
  options: string[];
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export default function Autocomplete({ value, onChange, onPick, options, placeholder, label, required }: Props) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => suggest(options, value), [options, value]);

  return (
    <div className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-600">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <input
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((m) => (
            <li key={m}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(m);
                  onPick?.(m);
                  setOpen(false);
                }}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
