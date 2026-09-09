import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '../lib/theme';

interface ThemeSwitcherProps {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  onChange: (pref: ThemePreference) => void;
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeSwitcher({ preference, resolvedTheme, onChange }: ThemeSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-overlay-3 hover:text-text"
        title="Theme — click to change"
      >
        <CurrentIcon size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-40 rounded-md border border-border bg-bg shadow-2xl">
          <div className="border-b border-border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-subtle">
            Theme
          </div>
          <div className="p-1">
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  value === preference
                    ? 'bg-overlay-3 text-text'
                    : 'text-text-dim hover:bg-overlay-2 hover:text-text'
                }`}
              >
                <Icon size={13} className="text-text-subtle" />
                <span className="flex-1">{label}</span>
                {value === preference && <Check size={12} className="text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
