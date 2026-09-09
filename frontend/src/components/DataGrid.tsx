import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, KeyRound, Loader2, Pencil, Trash2 } from 'lucide-react';
import { TableSkeleton } from './Skeleton';
import type { ColumnInfo, RowSort } from '../types';

interface DataGridProps {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  loading: boolean;
  sort: RowSort | null;
  onSortChange: (sort: RowSort | null) => void;
  onCellCommit: (row: Record<string, unknown>, colName: string, newValue: string) => void;
  onEditRow: (row: Record<string, unknown>) => void;
  onDeleteRow: (row: Record<string, unknown>) => void;
}

/**
 * Cycles a column through ascending, descending, then back to the table's default order.
 * Clicking a different column always starts that column at ascending.
 */
function nextSort(current: RowSort | null, column: string): RowSort | null {
  if (current?.column !== column) return { column, direction: 'asc' };
  if (current.direction === 'asc') return { column, direction: 'desc' };
  return null;
}

function sortLabel(current: RowSort | null, column: string): string {
  const next = nextSort(current, column);
  if (!next) return `Remove sorting on ${column}`;
  return `Sort by ${column} ${next.direction === 'asc' ? 'ascending' : 'descending'}`;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isUuidLike(dataType: string): boolean {
  return dataType.toLowerCase().includes('uuid');
}

function isJsonLike(dataType: string): boolean {
  const t = dataType.toLowerCase();
  return t.includes('json');
}

export function DataGrid({
  columns,
  rows,
  loading,
  sort,
  onSortChange,
  onCellCommit,
  onEditRow,
  onDeleteRow,
}: DataGridProps) {
  const [editing, setEditing] = useState<{ rowIdx: number; col: string } | null>(null);
  const [draft, setDraft] = useState('');

  const pkCols = columns.filter((c) => c.is_primary_key).map((c) => c.column_name);

  function startEdit(rowIdx: number, col: string, current: unknown) {
    if (pkCols.includes(col)) return;
    setEditing({ rowIdx, col });
    setDraft(formatCell(current));
  }

  function commit(row: Record<string, unknown>) {
    if (!editing) return;
    if (formatCell(row[editing.col]) !== draft) {
      onCellCommit(row, editing.col, draft);
    }
    setEditing(null);
  }

  // First load has no shape to preserve yet, so show a skeleton in the grid's place. A
  // refresh keeps the existing rows on screen under a dimming overlay instead, because
  // replacing populated data with placeholders reads as content being lost.
  if (loading && columns.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-2 overflow-hidden">
        <div className="h-4" />
        <TableSkeleton />
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
        Select a table, or create one with "New table".
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-hidden">
      <p className="text-xs text-text-subtle">
        Double-click a cell to edit it in place, or use <Pencil size={11} className="inline align-text-top" /> to edit
        the whole row.
      </p>
      <div className="relative flex-1 overflow-auto rounded-lg border border-border">
        {loading && (
          <div
            role="status"
            aria-label="Refreshing rows"
            className="absolute inset-0 z-10 flex items-center justify-center bg-bg/60 backdrop-blur-[1px]"
          >
            <Loader2 size={18} className="animate-spin text-accent motion-reduce:animate-none" />
          </div>
        )}
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead className="sticky top-0 z-[5] border-b border-border bg-bg/95 backdrop-blur-md">
            <tr className="select-none text-[11px] font-medium uppercase tracking-wider text-text-dim">
              {columns.map((c) => {
                const active = sort?.column === c.column_name ? sort : null;
                return (
                  <th
                    key={c.column_name}
                    aria-sort={active ? (active.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="px-0 py-0 text-left font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => onSortChange(nextSort(sort, c.column_name))}
                      title={sortLabel(sort, c.column_name)}
                      className={`group/sort flex w-full items-center gap-1.5 px-4 py-3 text-left transition-colors hover:bg-overlay-1 ${
                        active ? 'text-text' : ''
                      }`}
                    >
                      {c.is_primary_key && <KeyRound size={11} className="shrink-0 text-accent" />}
                      <span className="normal-case">{c.column_name}</span>
                      <span className="rounded bg-overlay-3 px-1 font-mono text-[10px] lowercase tracking-normal text-text-subtle">
                        {c.data_type}
                      </span>
                      {active ? (
                        active.direction === 'asc' ? (
                          <ArrowUp size={12} className="shrink-0 text-accent" />
                        ) : (
                          <ArrowDown size={12} className="shrink-0 text-accent" />
                        )
                      ) : (
                        <ChevronsUpDown
                          size={12}
                          className="shrink-0 text-text-subtle opacity-0 transition-opacity group-hover/sort:opacity-60"
                        />
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="w-16 px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-sm text-text-dim">
                  No rows found.
                </td>
              </tr>
            )}
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group transition-colors hover:bg-overlay-1">
                {columns.map((c) => {
                  const isPk = pkCols.includes(c.column_name);
                  const isEditing = editing?.rowIdx === rowIdx && editing.col === c.column_name;
                  const value = row[c.column_name];

                  return (
                    <td
                      key={c.column_name}
                      onDoubleClick={() => startEdit(rowIdx, c.column_name, value)}
                      className={`max-w-[280px] truncate px-4 py-2.5 ${isPk ? 'text-text-dim' : 'cursor-text'}`}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commit(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commit(row);
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          className="w-full rounded border border-accent bg-surface px-1.5 py-0.5 text-text outline-none"
                        />
                      ) : typeof value === 'boolean' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              value ? 'bg-accent shadow-[0_0_8px_var(--color-accent-glow)]' : 'bg-dot-off'
                            }`}
                          />
                          <span className={`text-xs ${value ? 'text-text-dim' : 'text-text-subtle'}`}>
                            {value ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      ) : isUuidLike(c.data_type) ? (
                        <span className="font-mono text-xs text-info/90">{formatCell(value)}</span>
                      ) : isJsonLike(c.data_type) ? (
                        <span className="font-mono text-xs text-text-subtle">{formatCell(value)}</span>
                      ) : isPk ? (
                        <span className="font-mono text-xs text-text-dim">{formatCell(value)}</span>
                      ) : (
                        formatCell(value)
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2.5">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onEditRow(row)}
                      className="rounded p-1 text-text-subtle hover:bg-accent/10 hover:text-accent"
                      title="Edit row"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteRow(row)}
                      className="rounded p-1 text-text-subtle hover:bg-danger/10 hover:text-danger"
                      title="Delete row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
