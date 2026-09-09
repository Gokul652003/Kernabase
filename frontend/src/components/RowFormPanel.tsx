import { useState } from 'react';
import { KeyRound, Pencil, Sparkles } from 'lucide-react';
import { SidePanel } from './SidePanel';
import type { ColumnInfo } from '../types';

export type RowFormMode = 'insert' | 'edit';

interface RowFormPanelProps {
  mode: RowFormMode;
  columns: ColumnInfo[];
  initialRow?: Record<string, unknown>;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isAuto(c: ColumnInfo): boolean {
  return c.is_identity || !!c.column_default;
}

function typeBadgeClass(dataType: string): string {
  const t = dataType.toLowerCase();
  if (t.includes('uuid')) return 'text-info';
  if (t.includes('json')) return 'text-violet';
  return 'text-text-subtle';
}

export function RowFormPanel({ mode, columns, initialRow, onClose, onSubmit }: RowFormPanelProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (mode === 'edit' && initialRow) {
      const init: Record<string, string> = {};
      for (const c of columns) init[c.column_name] = formatCell(initialRow[c.column_name]);
      return init;
    }
    return {};
  });
  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(col: string, v: string) {
    setValues((prev) => ({ ...prev, [col]: v }));
  }

  async function submit() {
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const c of columns) {
      if (mode === 'edit' && c.is_primary_key) continue;
      if (mode === 'insert' && isAuto(c) && !manualOverride[c.column_name]) continue;
      const v = values[c.column_name];
      if (mode === 'edit') {
        if (v !== undefined) payload[c.column_name] = v === '' ? null : v;
      } else if (v !== undefined && v !== '') {
        payload[c.column_name] = v;
      }
    }
    try {
      await onSubmit(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title={mode === 'insert' ? 'Insert row' : 'Edit row'}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-overlay-3 hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg shadow-sm hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'insert' ? 'Insert row' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {columns.map((c) => {
          if (mode === 'edit' && c.is_primary_key) {
            return (
              <div key={c.column_name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-text-subtle">
                    <KeyRound size={11} className="text-accent" />
                    {c.column_name}
                  </span>
                  <span className={`font-mono text-[10px] ${typeBadgeClass(c.data_type)}`}>{c.data_type}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                  <span className="truncate font-mono text-xs text-text-dim">{values[c.column_name]}</span>
                </div>
              </div>
            );
          }

          const auto = mode === 'insert' && isAuto(c);
          const overridden = manualOverride[c.column_name];
          const isBoolean = c.data_type.toLowerCase() === 'boolean';

          if (isBoolean && !(auto && !overridden)) {
            const checked = values[c.column_name] === 'true';
            return (
              <div key={c.column_name} className="flex items-center justify-between border-t border-b border-border py-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-text">
                    {c.column_name}
                    {mode === 'insert' && c.is_nullable === 'NO' && !c.column_default && !c.is_identity && (
                      <span className="text-[10px] text-danger">required</span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-subtle">{c.data_type}</div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => update(c.column_name, String(e.target.checked))}
                    className="peer sr-only"
                  />
                  <div className="peer h-4 w-8 rounded-full bg-track-off transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full" />
                </label>
              </div>
            );
          }

          return (
            <div key={c.column_name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 text-text-subtle">
                  {c.is_primary_key && <KeyRound size={11} className="text-accent" />}
                  {c.column_name}
                  {mode === 'insert' && c.is_nullable === 'NO' && !c.column_default && !c.is_identity && (
                    <span className="text-danger">required</span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] ${typeBadgeClass(c.data_type)}`}>{c.data_type}</span>
                  {auto && (
                    <button
                      type="button"
                      onClick={() => setManualOverride((prev) => ({ ...prev, [c.column_name]: !prev[c.column_name] }))}
                      className="flex items-center gap-1 text-[11px] text-text-subtle hover:text-accent"
                    >
                      <Pencil size={11} /> {overridden ? 'Use auto' : 'Set manually'}
                    </button>
                  )}
                </div>
              </div>

              {auto && !overridden ? (
                <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border bg-surface/50 px-3 py-2 text-xs text-text-subtle">
                  <Sparkles size={13} className="text-accent" />
                  Auto-generated on insert
                </div>
              ) : c.data_type.toLowerCase().includes('json') ? (
                <textarea
                  autoFocus={auto && overridden}
                  value={values[c.column_name] ?? ''}
                  onChange={(e) => update(c.column_name, e.target.value)}
                  placeholder={c.is_nullable === 'YES' ? 'NULL' : ''}
                  rows={5}
                  className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-text outline-none focus:border-accent"
                />
              ) : (
                <input
                  autoFocus={auto && overridden}
                  value={values[c.column_name] ?? ''}
                  onChange={(e) => update(c.column_name, e.target.value)}
                  placeholder={c.is_nullable === 'YES' ? 'NULL' : ''}
                  className={`w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-accent ${
                    isUuidLike(c.data_type) ? 'font-mono text-info' : ''
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </SidePanel>
  );
}

function isUuidLike(dataType: string): boolean {
  return dataType.toLowerCase().includes('uuid');
}
