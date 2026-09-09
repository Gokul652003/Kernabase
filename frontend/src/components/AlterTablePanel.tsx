import { useState } from 'react';
import { Check, KeyRound, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { SidePanel } from './SidePanel';
import { ColumnListSkeleton } from './Skeleton';
import {
  ALLOWED_COLUMN_TYPES,
  AUTO_GENERATE_TYPES,
  DEFAULT_EXPRESSIONS,
  type AddColumnDraft,
  type AlterColumnPatch,
  type ColumnInfo,
  type ColumnType,
} from '../types';

interface AlterTablePanelProps {
  tableName: string;
  schema: string;
  columns: ColumnInfo[];
  loading: boolean;
  onClose: () => void;
  onRenameTable: (name: string) => Promise<void>;
  onAddColumn: (draft: AddColumnDraft) => Promise<void>;
  onAlterColumn: (column: string, patch: AlterColumnPatch) => Promise<void>;
  onDropColumn: (column: string) => Promise<void>;
}

interface ColumnEdit {
  name: string;
  /** Empty means "keep the current type" — see the note on buildPatch. */
  type: '' | ColumnType;
  nullable: boolean;
  defaultValue: string;
  dropDefault: boolean;
}

function emptyDraft(): AddColumnDraft {
  return { name: '', type: 'text', nullable: true, autoGenerate: false };
}

function editFrom(column: ColumnInfo): ColumnEdit {
  return {
    name: column.column_name,
    type: '',
    nullable: column.is_nullable === 'YES',
    defaultValue: '',
    dropDefault: false,
  };
}

/**
 * Sends only what the user actually changed.
 *
 * The type select starts empty rather than pre-selected because `information_schema`
 * reports types in a different vocabulary than the one we can create ("character
 * varying" vs "varchar"). Guessing a mapping risks silently rewriting a column's type
 * on an unrelated edit, so an untouched select sends nothing at all.
 */
function buildPatch(original: ColumnInfo, edit: ColumnEdit): AlterColumnPatch {
  const patch: AlterColumnPatch = {};
  if (edit.name.trim() && edit.name.trim() !== original.column_name) patch.name = edit.name.trim();
  if (edit.type !== '') patch.type = edit.type;
  if (edit.nullable !== (original.is_nullable === 'YES')) patch.nullable = edit.nullable;
  if (edit.dropDefault) patch.dropDefault = true;
  else if (edit.defaultValue.trim()) patch.defaultValue = edit.defaultValue.trim();
  return patch;
}

export function AlterTablePanel({
  tableName,
  schema,
  columns,
  loading,
  onClose,
  onRenameTable,
  onAddColumn,
  onAlterColumn,
  onDropColumn,
}: AlterTablePanelProps) {
  const [rename, setRename] = useState(tableName);
  const [draft, setDraft] = useState<AddColumnDraft>(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [edit, setEdit] = useState<ColumnEdit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsAuto = AUTO_GENERATE_TYPES.includes(draft.type);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(column: ColumnInfo) {
    setEditingColumn(column.column_name);
    setEdit(editFrom(column));
    setError(null);
  }

  async function saveEdit(column: ColumnInfo) {
    if (!edit) return;
    const patch = buildPatch(column, edit);
    if (Object.keys(patch).length === 0) {
      setEditingColumn(null);
      return;
    }
    await run(async () => {
      await onAlterColumn(column.column_name, patch);
      setEditingColumn(null);
    });
  }

  async function submitAdd() {
    if (!draft.name.trim()) {
      setError('Column name is required');
      return;
    }
    await run(async () => {
      await onAddColumn({
        ...draft,
        name: draft.name.trim(),
        defaultValue: draft.defaultValue?.trim() ? draft.defaultValue.trim() : undefined,
      });
      setDraft(emptyDraft());
      setAdding(false);
    });
  }

  return (
    <SidePanel title={`Edit ${schema === 'public' ? tableName : `${schema}.${tableName}`}`} onClose={onClose} widthClassName="w-[520px]">
      <section className="mb-6">
        <label className="mb-1 block text-xs text-text-dim">Table name</label>
        <div className="flex gap-2">
          <input
            value={rename}
            onChange={(e) => setRename(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={() => run(() => onRenameTable(rename.trim()))}
            disabled={busy || !rename.trim() || rename.trim() === tableName}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-text-dim transition hover:bg-overlay-3 hover:text-text disabled:opacity-40"
          >
            Rename
          </button>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Columns</span>
          <span className="text-[11px] text-text-subtle">{columns.length}</span>
        </div>

        {loading && columns.length === 0 && <ColumnListSkeleton />}

        <div className={`flex flex-col gap-2 ${loading ? 'opacity-60' : ''}`}>
          {columns.map((column) => {
            const isEditing = editingColumn === column.column_name;

            if (!isEditing) {
              return (
                <div
                  key={column.column_name}
                  className="flex items-center gap-2 rounded-lg border border-border bg-overlay-1 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {column.is_primary_key && <KeyRound size={11} className="shrink-0 text-accent" />}
                      <span className="truncate text-sm text-text">{column.column_name}</span>
                      <span className="shrink-0 rounded bg-overlay-3 px-1 font-mono text-[10px] text-text-subtle">
                        {column.data_type}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-text-subtle">
                      {column.is_nullable === 'YES' ? 'nullable' : 'not null'}
                      {column.column_default ? ` · default ${column.column_default}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(column)}
                    disabled={busy}
                    className="shrink-0 rounded p-1.5 text-text-subtle hover:bg-accent/10 hover:text-accent disabled:opacity-40"
                    title="Edit column"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Drop column "${column.column_name}" and all its data? This cannot be undone.`)) {
                        void run(() => onDropColumn(column.column_name));
                      }
                    }}
                    disabled={busy}
                    className="shrink-0 rounded p-1.5 text-text-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                    title="Drop column"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            }

            return (
              <div key={column.column_name} className="rounded-lg border border-accent/40 bg-overlay-1 p-3">
                <div className="mb-2 flex gap-2">
                  <input
                    value={edit?.name ?? ''}
                    onChange={(e) => setEdit((p) => (p ? { ...p, name: e.target.value } : p))}
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <select
                    value={edit?.type ?? ''}
                    onChange={(e) => setEdit((p) => (p ? { ...p, type: e.target.value as ColumnEdit['type'] } : p))}
                    className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="">Keep {column.data_type}</option>
                    {ALLOWED_COLUMN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2 flex gap-2">
                  <input
                    value={edit?.defaultValue ?? ''}
                    onChange={(e) => setEdit((p) => (p ? { ...p, defaultValue: e.target.value, dropDefault: false } : p))}
                    placeholder={column.column_default ? `current: ${column.column_default}` : 'Set a default…'}
                    disabled={edit?.dropDefault}
                    list="kernabase-default-expressions"
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-40"
                  />
                </div>

                <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-dim">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={edit?.nullable ?? false}
                      onChange={(e) => setEdit((p) => (p ? { ...p, nullable: e.target.checked } : p))}
                    />
                    Nullable
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={edit?.dropDefault ?? false}
                      onChange={(e) => setEdit((p) => (p ? { ...p, dropDefault: e.target.checked, defaultValue: '' } : p))}
                    />
                    Drop default
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingColumn(null)}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-text-dim hover:bg-overlay-3 hover:text-text"
                  >
                    <X size={12} /> Cancel
                  </button>
                  <button
                    onClick={() => void saveEdit(column)}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:brightness-110 disabled:opacity-50"
                  >
                    <Check size={12} /> {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {adding ? (
          <div className="mt-3 rounded-lg border border-accent/40 bg-overlay-1 p-3">
            <div className="mb-2 flex gap-2">
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="column_name"
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <select
                value={draft.type}
                onChange={(e) => {
                  const type = e.target.value as ColumnType;
                  setDraft((d) => ({ ...d, type, autoGenerate: AUTO_GENERATE_TYPES.includes(type) && d.autoGenerate }));
                }}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
              >
                {ALLOWED_COLUMN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <input
              value={draft.defaultValue ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, defaultValue: e.target.value }))}
              placeholder="Default value (optional)"
              disabled={draft.autoGenerate}
              list="kernabase-default-expressions"
              className="mb-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-40"
            />

            <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-dim">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.nullable}
                  onChange={(e) => setDraft((d) => ({ ...d, nullable: e.target.checked }))}
                />
                Nullable
              </label>
              <label
                className={`flex items-center gap-1.5 ${supportsAuto ? '' : 'opacity-30'}`}
                title="Identity for integer types, gen_random_uuid() for uuid"
              >
                <input
                  type="checkbox"
                  disabled={!supportsAuto}
                  checked={supportsAuto && draft.autoGenerate}
                  onChange={(e) => setDraft((d) => ({ ...d, autoGenerate: e.target.checked, defaultValue: '' }))}
                />
                <Sparkles size={12} className={draft.autoGenerate && supportsAuto ? 'text-accent' : ''} />
                Auto-generate
              </label>
            </div>

            {!draft.nullable && !draft.defaultValue?.trim() && !draft.autoGenerate && (
              <p className="mb-2 text-[11px] text-warn">
                A NOT NULL column needs a default unless the table is empty.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAdding(false);
                  setDraft(emptyDraft());
                }}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-text-dim hover:bg-overlay-3 hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitAdd()}
                disabled={busy}
                className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Adding…' : 'Add column'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-sm text-text-dim hover:bg-surface-hover"
          >
            <Plus size={14} /> Add column
          </button>
        )}
      </section>

      {/* Offered as suggestions, not a fixed list: any other value is stored as a literal. */}
      <datalist id="kernabase-default-expressions">
        {DEFAULT_EXPRESSIONS.map((expression) => (
          <option key={expression} value={expression} />
        ))}
      </datalist>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </SidePanel>
  );
}
