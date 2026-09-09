import { useMemo, useState } from 'react';
import { DatabaseZap, Plus, Search, Table2 } from 'lucide-react';
import { RefreshButton } from './RefreshButton';
import { TableListSkeleton } from './Skeleton';
import type { TableInfo } from '../types';

interface SidebarProps {
  tables: TableInfo[];
  currentTable: string | null;
  loading: boolean;
  onSelectTable: (name: string) => void;
  onNewTable: () => void;
  onRefresh: () => void;
}

export function Sidebar({ tables, currentTable, loading, onSelectTable, onNewTable, onRefresh }: SidebarProps) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(
    () => tables.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase())),
    [tables, filter],
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 border-r border-border bg-bg p-3">
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">Tables</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-text-subtle">{tables.length}</span>
          <RefreshButton onClick={onRefresh} busy={loading} label="Refresh tables" className="h-6 w-6" />
        </div>
      </div>

      <button
        onClick={onNewTable}
        className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg shadow-sm transition hover:brightness-110 active:scale-[0.98]"
      >
        <Plus size={16} /> New table
      </button>

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-text-subtle" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tables"
          className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-2 text-xs text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && tables.length === 0 && <TableListSkeleton />}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-xs text-text-dim">
            <DatabaseZap size={22} className="text-text-subtle" />
            {tables.length === 0 ? 'No tables yet — create one to get started' : 'No matches'}
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {filtered.map((t) => (
            <button
              key={t.name}
              onClick={() => onSelectTable(t.name)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                t.name === currentTable
                  ? 'border border-border bg-overlay-4 text-text shadow-sm'
                  : 'border border-transparent text-text-dim hover:bg-overlay-2 hover:text-text'
              }`}
            >
              <Table2 size={14} className={`shrink-0 ${t.name === currentTable ? 'text-accent' : ''}`} />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
