import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Layers, Plus } from 'lucide-react';
import { RefreshButton } from './RefreshButton';

interface SchemaSwitcherProps {
  schemas: string[];
  currentSchema: string;
  onSelect: (schema: string) => void;
  onNewSchema: () => void;
  onRefresh: () => void;
  loading?: boolean;
}

export function SchemaSwitcher({ schemas, currentSchema, onSelect, onNewSchema, onRefresh, loading = false }: SchemaSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
        title="Current schema — click to switch or create one"
      >
        <Layers size={12} className="text-text-subtle" />
        <span className="font-mono">{currentSchema}</span>
        <ChevronDown size={12} className="text-text-subtle" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-52 rounded-md border border-border bg-bg shadow-2xl">
          <div className="flex items-center justify-between border-b border-border py-1 pl-2.5 pr-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">Schema</span>
            <RefreshButton
              onClick={onRefresh}
              busy={loading}
              label="Refresh schemas"
              className="h-6 w-6 border-transparent"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {schemas.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left font-mono text-xs transition-colors ${
                  s === currentSchema
                    ? 'bg-overlay-4 text-text'
                    : 'text-text-dim hover:bg-overlay-3 hover:text-text'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <button
              onClick={() => {
                onNewSchema();
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-text-subtle transition-colors hover:bg-overlay-3 hover:text-accent"
            >
              <Plus size={13} /> New schema
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
