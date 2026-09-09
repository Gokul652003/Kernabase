import { ChevronLeft, ChevronRight, Plus, Settings2, Trash2 } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { FilterBar } from './FilterBar';
import { RefreshButton } from './RefreshButton';
import type { ColumnInfo, RowFilter, RowSort } from '../types';

interface TableEditorProps {
  tableName: string | null;
  schema: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
  offset: number;
  limit: number;
  loading: boolean;
  filters: RowFilter[];
  sort: RowSort | null;
  onFiltersChange: (filters: RowFilter[]) => void;
  onSortChange: (sort: RowSort | null) => void;
  onCellCommit: (row: Record<string, unknown>, colName: string, newValue: string) => void;
  onEditRow: (row: Record<string, unknown>) => void;
  onDeleteRow: (row: Record<string, unknown>) => void;
  onInsertRow: () => void;
  onRefresh: () => void;
  onEditTable: () => void;
  onDeleteTable: () => void;
  onPageChange: (offset: number) => void;
}

export function TableEditor({
  tableName,
  schema,
  columns,
  rows,
  total,
  offset,
  limit,
  loading,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onCellCommit,
  onEditRow,
  onDeleteRow,
  onInsertRow,
  onRefresh,
  onEditTable,
  onDeleteTable,
  onPageChange,
}: TableEditorProps) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-text">
          {tableName ? (
            schema !== 'public' ? (
              <>
                <span className="text-text-subtle">{schema}.</span>
                {tableName}
              </>
            ) : (
              tableName
            )
          ) : (
            'Select a table'
          )}
        </h2>
        <div className="flex gap-2">
          <RefreshButton onClick={onRefresh} busy={loading} disabled={!tableName} label="Refresh rows" showLabel />
          <button
            onClick={onInsertRow}
            disabled={!tableName}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg shadow-sm transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            <Plus size={14} /> Insert row
          </button>
          <button
            onClick={onEditTable}
            disabled={!tableName}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-dim transition hover:bg-overlay-3 hover:text-text disabled:opacity-40"
          >
            <Settings2 size={14} /> Edit table
          </button>
          <button
            onClick={onDeleteTable}
            disabled={!tableName}
            className="flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-1.5 text-xs text-danger transition hover:bg-danger/10 disabled:opacity-40"
          >
            <Trash2 size={14} /> Delete table
          </button>
        </div>
      </div>

      {tableName && columns.length > 0 && (
        <FilterBar columns={columns} filters={filters} onChange={onFiltersChange} />
      )}

      <DataGrid
        columns={columns}
        rows={rows}
        loading={loading}
        sort={sort}
        onSortChange={onSortChange}
        onCellCommit={onCellCommit}
        onEditRow={onEditRow}
        onDeleteRow={onDeleteRow}
      />

      {tableName && (
        <div className="flex h-10 shrink-0 items-center justify-between text-xs">
          <span className="text-text-dim">
            Showing <strong className="font-mono font-medium text-text">{from}–{to}</strong> of{' '}
            <strong className="font-mono font-medium text-text">{total}</strong> rows
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-subtle transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => onPageChange(offset + limit)}
              disabled={offset + limit >= total}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-subtle transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
