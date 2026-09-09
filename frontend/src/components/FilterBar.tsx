import { useEffect, useState } from 'react';
import { Filter, Plus, X } from 'lucide-react';
import { FILTER_OPS, type ColumnInfo, type FilterOpValue, type RowFilter } from '../types';

interface FilterBarProps {
  columns: ColumnInfo[];
  filters: RowFilter[];
  onChange: (filters: RowFilter[]) => void;
}

function emptyCondition(columns: ColumnInfo[]): RowFilter {
  return { column: columns[0]?.column_name ?? '', op: 'eq' as FilterOpValue, value: '' };
}

export function FilterBar({ columns, filters, onChange }: FilterBarProps) {
  const [draft, setDraft] = useState<RowFilter[]>(filters.length > 0 ? filters : [emptyCondition(columns)]);

  // Keep the draft in sync when filters are committed/cleared elsewhere (e.g. switching tables).
  useEffect(() => {
    setDraft(filters.length > 0 ? filters : [emptyCondition(columns)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, columns[0]?.column_name]);

  function updateAt(idx: number, patch: Partial<RowFilter>) {
    setDraft((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function removeAt(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCondition() {
    setDraft((prev) => [...prev, emptyCondition(columns)]);
  }

  function apply() {
    onChange(draft.filter((f) => f.column));
  }

  function clearAll() {
    setDraft([emptyCondition(columns)]);
    onChange([]);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-overlay-1 px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-dim">
        <Filter size={13} className="text-text-subtle" />
        Filter
        {filters.length > 0 && (
          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
            {filters.length}
          </span>
        )}
      </span>

      {draft.map((cond, idx) => {
        const needsValue = cond.op !== 'is_null' && cond.op !== 'is_not_null';
        return (
          <div
            key={idx}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1"
          >
            {idx > 0 && <span className="text-[10px] font-semibold text-text-subtle">AND</span>}
            <select
              value={cond.column}
              onChange={(e) => updateAt(idx, { column: e.target.value })}
              className="rounded bg-transparent font-mono text-[11px] text-text outline-none"
            >
              {columns.map((c) => (
                <option key={c.column_name} value={c.column_name} className="bg-surface">
                  {c.column_name}
                </option>
              ))}
            </select>
            <select
              value={cond.op}
              onChange={(e) => updateAt(idx, { op: e.target.value as FilterOpValue })}
              className="rounded bg-transparent text-[11px] text-text-dim outline-none"
            >
              {FILTER_OPS.map((o) => (
                <option key={o.value} value={o.value} className="bg-surface">
                  {o.label}
                </option>
              ))}
            </select>
            {needsValue && (
              <input
                value={cond.value}
                onChange={(e) => updateAt(idx, { value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') apply();
                }}
                placeholder="value"
                className="w-24 rounded bg-transparent font-mono text-[11px] text-accent outline-none placeholder:text-text-subtle"
              />
            )}
            <button
              onClick={() => removeAt(idx)}
              disabled={draft.length === 1}
              className="text-text-subtle transition-colors hover:text-text disabled:opacity-30"
              title="Remove condition"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      <button
        onClick={addCondition}
        className="flex items-center gap-1 text-xs text-text-subtle transition-colors hover:text-accent"
      >
        <Plus size={13} /> Add condition
      </button>

      <div className="ml-auto flex items-center gap-2">
        {filters.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 rounded p-1 text-xs text-text-subtle hover:bg-overlay-3 hover:text-text"
          >
            <X size={12} /> Clear all
          </button>
        )}
        <button
          onClick={apply}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg transition hover:brightness-110"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
