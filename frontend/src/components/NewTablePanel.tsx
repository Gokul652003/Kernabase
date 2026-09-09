import { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { SidePanel } from './SidePanel';
import { ALLOWED_COLUMN_TYPES, AUTO_GENERATE_TYPES, type NewColumnDraft } from '../types';

interface NewTablePanelProps {
  onClose: () => void;
  onCreate: (name: string, columns: NewColumnDraft[]) => Promise<void>;
}

function defaultColumns(): NewColumnDraft[] {
  return [
    { name: 'id', type: 'bigint', primaryKey: true, nullable: false, autoGenerate: true },
    { name: 'created_at', type: 'timestamptz', primaryKey: false, nullable: true, autoGenerate: false },
  ];
}

export function NewTablePanel({ onClose, onCreate }: NewTablePanelProps) {
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<NewColumnDraft[]>(defaultColumns());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateColumn(idx: number, patch: Partial<NewColumnDraft>) {
    setColumns((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, ...patch };
        const supportsAuto = AUTO_GENERATE_TYPES.includes(next.type);
        if (!supportsAuto) {
          next.autoGenerate = false;
        } else if (patch.autoGenerate === undefined && (patch.primaryKey === true || patch.type !== undefined) && next.primaryKey) {
          next.autoGenerate = true;
        }
        return next;
      }),
    );
  }

  function removeColumn(idx: number) {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Table name is required');
      return;
    }
    if (columns.length === 0) {
      setError('Add at least one column');
      return;
    }
    if (columns.some((c) => !c.name.trim())) {
      setError('All columns need a name');
      return;
    }
    setSaving(true);
    try {
      await onCreate(name.trim(), columns);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="New table"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-overlay-3 hover:text-text">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg shadow-sm hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create table'}
          </button>
        </>
      }
    >
      <label className="mb-1 block text-xs text-text-dim">Table name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. users"
        className="mb-5 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Columns</span>
      </div>

      <div className="flex flex-col gap-3">
        {columns.map((col, idx) => {
          const supportsAuto = AUTO_GENERATE_TYPES.includes(col.type);
          return (
            <div key={idx} className="rounded-lg border border-border bg-overlay-1 p-3">
              <div className="mb-2 flex gap-2">
                <input
                  value={col.name}
                  onChange={(e) => updateColumn(idx, { name: e.target.value })}
                  placeholder="column_name"
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                />
                <select
                  value={col.type}
                  onChange={(e) => updateColumn(idx, { type: e.target.value as NewColumnDraft['type'] })}
                  className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                >
                  {ALLOWED_COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeColumn(idx)}
                  className="shrink-0 rounded p-1.5 text-text-dim hover:bg-danger/10 hover:text-danger"
                  title="Remove column"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-dim">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={col.primaryKey}
                    onChange={(e) => updateColumn(idx, { primaryKey: e.target.checked })}
                  />
                  Primary key
                </label>
                <label
                  className={`flex items-center gap-1.5 ${supportsAuto ? '' : 'opacity-30'}`}
                  title="Auto-generate a value on insert (identity for integers, gen_random_uuid() for uuid)"
                >
                  <input
                    type="checkbox"
                    disabled={!supportsAuto}
                    checked={supportsAuto && col.autoGenerate}
                    onChange={(e) => updateColumn(idx, { autoGenerate: e.target.checked })}
                  />
                  <Sparkles size={12} className={col.autoGenerate && supportsAuto ? 'text-accent' : ''} />
                  Auto-generate
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={col.nullable}
                    onChange={(e) => updateColumn(idx, { nullable: e.target.checked })}
                  />
                  Nullable
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() =>
          setColumns((prev) => [...prev, { name: '', type: 'text', primaryKey: false, nullable: true, autoGenerate: false }])
        }
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-sm text-text-dim hover:bg-surface-hover"
      >
        <Plus size={14} /> Add column
      </button>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </SidePanel>
  );
}
