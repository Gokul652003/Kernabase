import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Table2, TerminalSquare } from 'lucide-react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { TableEditor } from '../components/TableEditor';
import { SqlEditor } from '../components/SqlEditor';
import { PoliciesPanel } from '../components/PoliciesPanel';
import { NewTablePanel } from '../components/NewTablePanel';
import { AlterTablePanel } from '../components/AlterTablePanel';
import { NewSchemaPanel } from '../components/NewSchemaPanel';
import { RowFormPanel } from '../components/RowFormPanel';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';
import type { AddColumnDraft, AlterColumnPatch, ColumnInfo, NewColumnDraft, RowFilter, RowSort, TableInfo } from '../types';

const LIMIT = 100;

const TABS = ['editor', 'sql', 'policies'] as const;
type Tab = (typeof TABS)[number];

/**
 * What the user is looking at lives in the query string, not in component state.
 *
 * Anything held only in `useState` is lost on reload and invisible to the back button —
 * selecting a table used to leave the URL untouched, so refreshing dropped you back to
 * "no table selected". Keeping schema, table, tab, sort, filters and page in the URL
 * makes the view reloadable, shareable and navigable with browser history.
 */
/** Everything that scopes a row listing, cleared when the table or schema changes. */
const CLEARED_VIEW: Record<string, string | null> = { page: null, filters: null, sort: null, dir: null };

function parseFilters(raw: string): RowFilter[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RowFilter[]) : [];
  } catch {
    return [];
  }
}

export function ProjectPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { preference: themePreference, resolvedTheme, setPreference: setThemePreference } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectName, setProjectName] = useState('');
  const [schemas, setSchemas] = useState<string[]>(['public']);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [newSchemaModalOpen, setNewSchemaModalOpen] = useState(false);
  const [insertModalOpen, setInsertModalOpen] = useState(false);
  const [alterTableOpen, setAlterTableOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const toast = useToast();

  if (!projectIdParam) throw new Error('ProjectPage rendered without a projectId route param');
  const projectId: string = projectIdParam;

  const currentSchema = searchParams.get('schema') || 'public';
  const currentTable = searchParams.get('table');
  const tabParam = searchParams.get('tab');
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'editor';
  const sortColumn = searchParams.get('sort');
  const sortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const filtersParam = searchParams.get('filters') ?? '';
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const offset = (page - 1) * LIMIT;

  // Memoized so the load effect below compares by the URL string, not object identity.
  const filters = useMemo(() => parseFilters(filtersParam), [filtersParam]);
  const sort = useMemo<RowSort | null>(
    () => (sortColumn ? { column: sortColumn, direction: sortDir } : null),
    [sortColumn, sortDir],
  );

  /** Patches the query string; a null or empty value drops the parameter entirely. */
  const updateView = useCallback(
    (patch: Record<string, string | null>, options?: { replace?: boolean }) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );


  useEffect(() => {
    api
      .getProject(projectId)
      .then((p) => setProjectName(p.name))
      .catch(() => {
        toast.error('Project not found');
        navigate('/dashboard', { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadSchemas = useCallback(async () => {
    setSchemasLoading(true);
    try {
      const list = await api.listSchemas(projectId);
      setSchemas(list.length > 0 ? list : ['public']);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSchemasLoading(false);
    }
  }, [toast, projectId]);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      setTables(await api.listTables(projectId, currentSchema));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTablesLoading(false);
    }
  }, [toast, projectId, currentSchema]);

  const loadTableData = useCallback(
    async (table: string, off: number, activeFilters: RowFilter[], activeSort: RowSort | null) => {
      setTableLoading(true);
      try {
        const [schema, data] = await Promise.all([
          api.getSchema(projectId, table, currentSchema),
          api.getRows(projectId, table, LIMIT, off, activeFilters, currentSchema, activeSort),
        ]);
        setColumns(schema);
        setRows(data.rows);
        setTotal(data.total ?? 0);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setTableLoading(false);
      }
    },
    [toast, projectId, currentSchema],
  );

  useEffect(() => {
    loadSchemas();
  }, [loadSchemas]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // A single effect owns loading: every handler just changes the URL, and the view
  // follows. That also removes the need to thread "the sort I am about to apply"
  // through each call to dodge stale state.
  useEffect(() => {
    if (!currentTable) {
      setColumns([]);
      setRows([]);
      setTotal(0);
      return;
    }
    void loadTableData(currentTable, offset, filters, sort);
  }, [currentTable, offset, filters, sort, loadTableData]);

  // A link to a table that has since been dropped (or renamed) should not leave the page
  // stuck on an error; drop it from the URL once the real table list is known.
  useEffect(() => {
    if (tablesLoading || !currentTable || tables.length === 0) return;
    if (!tables.some((t) => t.name === currentTable)) {
      updateView({ table: null, ...CLEARED_VIEW }, { replace: true });
    }
  }, [tablesLoading, tables, currentTable, updateView]);

  function selectSchema(schema: string) {
    if (schema === currentSchema) return;
    updateView({ schema: schema === 'public' ? null : schema, table: null, ...CLEARED_VIEW });
  }

  async function handleCreateSchema(name: string) {
    await api.createSchema(projectId, name);
    setNewSchemaModalOpen(false);
    toast.success(`Schema "${name}" created`);
    await loadSchemas();
    updateView({ schema: name === 'public' ? null : name, table: null, ...CLEARED_VIEW });
  }

  function selectTable(name: string) {
    updateView({ table: name, ...CLEARED_VIEW });
  }

  function handleFiltersChange(newFilters: RowFilter[]) {
    updateView({ filters: newFilters.length > 0 ? JSON.stringify(newFilters) : null, page: null });
  }

  // Re-sorting reshuffles which rows land on which page, so it returns to the first one.
  function handleSortChange(newSort: RowSort | null) {
    updateView({ sort: newSort?.column ?? null, dir: newSort?.direction ?? null, page: null });
  }

  function pkOf(row: Record<string, unknown>): Record<string, unknown> {
    const pk: Record<string, unknown> = {};
    columns.filter((c) => c.is_primary_key).forEach((c) => (pk[c.column_name] = row[c.column_name]));
    return pk;
  }

  async function handleCellCommit(row: Record<string, unknown>, colName: string, newValue: string) {
    if (!currentTable) return;
    const pk = pkOf(row);
    if (Object.keys(pk).length === 0) {
      toast.error('This table has no primary key, so rows cannot be edited safely.');
      return;
    }
    try {
      await api.updateRow(projectId, currentTable, pk, { [colName]: newValue === '' ? null : newValue }, currentSchema);
      await refreshRows();
    } catch (err) {
      toast.error(`Update failed: ${(err as Error).message}`);
      await refreshRows();
    }
  }

  async function handleEditRowSubmit(values: Record<string, unknown>) {
    if (!currentTable || !editingRow) return;
    const pk = pkOf(editingRow);
    await api.updateRow(projectId, currentTable, pk, values, currentSchema);
    setEditingRow(null);
    toast.success('Row updated');
    await refreshRows();
  }

  async function handleDeleteRow(row: Record<string, unknown>) {
    if (!currentTable) return;
    const pk = pkOf(row);
    if (Object.keys(pk).length === 0) {
      toast.error('This table has no primary key, so rows cannot be deleted safely.');
      return;
    }
    if (!confirm('Delete this row?')) return;
    try {
      await api.deleteRow(projectId, currentTable, pk, currentSchema);
      toast.success('Row deleted');
      await refreshRows();
      await loadTables();
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  }

  async function handleInsertRow(values: Record<string, unknown>) {
    if (!currentTable) return;
    await api.insertRow(projectId, currentTable, values, currentSchema);
    setInsertModalOpen(false);
    toast.success('Row inserted');
    await refreshRows();
    await loadTables();
  }

  // Structural changes invalidate both the column list and the rows on screen, so each
  // one reloads the table rather than patching local state.
  async function handleAddColumn(draft: AddColumnDraft) {
    if (!currentTable) return;
    await api.addColumn(projectId, currentTable, draft, currentSchema);
    toast.success(`Column "${draft.name}" added`);
    await refreshRows();
  }

  async function handleAlterColumn(column: string, patch: AlterColumnPatch) {
    if (!currentTable) return;
    await api.alterColumn(projectId, currentTable, column, patch, currentSchema);
    toast.success(`Column "${column}" updated`);
    // A rename leaves any sort or filter pointing at a column that no longer exists.
    if (patch.name) forgetColumnInView(column);
    else await refreshRows();
  }

  async function handleDropColumn(column: string) {
    if (!currentTable) return;
    await api.dropColumn(projectId, currentTable, column, currentSchema);
    toast.success(`Column "${column}" dropped`);
    forgetColumnInView(column);
  }

  /**
   * Clears any sort or filter naming a column that is gone. Changing the URL re-runs the
   * load effect, so when it does change this must not also call refreshRows — that would
   * fetch the table twice.
   */
  function forgetColumnInView(column: string) {
    const nextFilters = filters.filter((f) => f.column !== column);
    const sortAffected = sort?.column === column;
    if (nextFilters.length === filters.length && !sortAffected) {
      void refreshRows();
      return;
    }
    updateView({
      filters: nextFilters.length > 0 ? JSON.stringify(nextFilters) : null,
      ...(sortAffected ? { sort: null, dir: null } : {}),
    });
  }

  async function handleRenameTable(name: string) {
    if (!currentTable) return;
    await api.renameTable(projectId, currentTable, name, currentSchema);
    toast.success(`Table renamed to "${name}"`);
    setAlterTableOpen(false);
    await loadTables();
    selectTable(name);
  }

  async function handleDeleteTable() {
    if (!currentTable) return;
    if (!confirm(`Drop table "${currentTable}"? This cannot be undone.`)) return;
    try {
      await api.dropTable(projectId, currentTable, currentSchema);
      toast.success(`Table "${currentTable}" dropped`);
      updateView({ table: null, ...CLEARED_VIEW });
      await loadTables();
    } catch (err) {
      toast.error(`Delete table failed: ${(err as Error).message}`);
    }
  }

  // Re-reads the current table from the database, keeping page, filters and sort as they
  // are — for picking up rows another session (or an MCP client) has changed.
  async function refreshRows() {
    if (!currentTable) return;
    await loadTableData(currentTable, offset, filters, sort);
  }

  function handlePageChange(newOffset: number) {
    updateView({ page: newOffset <= 0 ? null : String(Math.floor(newOffset / LIMIT) + 1) });
  }

  function selectTab(next: Tab) {
    updateView({ tab: next === 'editor' ? null : next });
  }

  async function handleCreateTable(name: string, cols: NewColumnDraft[]) {
    await api.createTable(projectId, name, cols, currentSchema);
    setModalOpen(false);
    toast.success(`Table "${name}" created`);
    await loadTables();
    selectTable(name);
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        projectId={projectId}
        projectName={projectName || '…'}
        userEmail={user?.email}
        onLogout={handleLogout}
        schemas={schemas}
        currentSchema={currentSchema}
        onSelectSchema={selectSchema}
        onNewSchema={() => setNewSchemaModalOpen(true)}
        onRefreshSchemas={() => void loadSchemas()}
        schemasLoading={schemasLoading}
        themePreference={themePreference}
        resolvedTheme={resolvedTheme}
        onThemeChange={setThemePreference}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          tables={tables}
          currentTable={currentTable}
          loading={tablesLoading}
          onSelectTable={selectTable}
          onNewTable={() => setModalOpen(true)}
          onRefresh={() => void loadTables()}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex border-b border-border bg-bg">
            <button
              onClick={() => selectTab('editor')}
              className={`flex items-center gap-1.5 border-b-2 px-5 py-3 text-sm font-medium ${
                tab === 'editor' ? 'border-accent text-text' : 'border-transparent text-text-dim hover:text-text'
              }`}
            >
              <Table2 size={14} /> Table Editor
            </button>
            <button
              onClick={() => selectTab('sql')}
              className={`flex items-center gap-1.5 border-b-2 px-5 py-3 text-sm font-medium ${
                tab === 'sql' ? 'border-accent text-text' : 'border-transparent text-text-dim hover:text-text'
              }`}
            >
              <TerminalSquare size={14} /> SQL Editor
            </button>
            <button
              onClick={() => selectTab('policies')}
              className={`flex items-center gap-1.5 border-b-2 px-5 py-3 text-sm font-medium ${
                tab === 'policies' ? 'border-accent text-text' : 'border-transparent text-text-dim hover:text-text'
              }`}
            >
              <ShieldCheck size={14} /> Policies
            </button>
          </div>

          {tab === 'editor' && (
            <TableEditor
              tableName={currentTable}
              schema={currentSchema}
              columns={columns}
              rows={rows}
              total={total}
              offset={offset}
              limit={LIMIT}
              loading={tableLoading}
              filters={filters}
              sort={sort}
              onFiltersChange={handleFiltersChange}
              onSortChange={handleSortChange}
              onCellCommit={handleCellCommit}
              onEditRow={(row) => setEditingRow(row)}
              onDeleteRow={handleDeleteRow}
              onRefresh={() => void refreshRows()}
              onInsertRow={() => setInsertModalOpen(true)}
              onEditTable={() => setAlterTableOpen(true)}
              onDeleteTable={handleDeleteTable}
              onPageChange={handlePageChange}
            />
          )}
          {tab === 'sql' && <SqlEditor onSchemaChange={loadTables} theme={resolvedTheme} projectId={projectId} />}
          {tab === 'policies' && <PoliciesPanel tableName={currentTable} schema={currentSchema} projectId={projectId} />}
        </main>
      </div>

      {modalOpen && <NewTablePanel onClose={() => setModalOpen(false)} onCreate={handleCreateTable} />}

      {alterTableOpen && currentTable && (
        <AlterTablePanel
          tableName={currentTable}
          schema={currentSchema}
          columns={columns}
          loading={tableLoading}
          onClose={() => setAlterTableOpen(false)}
          onRenameTable={handleRenameTable}
          onAddColumn={handleAddColumn}
          onAlterColumn={handleAlterColumn}
          onDropColumn={handleDropColumn}
        />
      )}
      {newSchemaModalOpen && (
        <NewSchemaPanel onClose={() => setNewSchemaModalOpen(false)} onCreate={handleCreateSchema} />
      )}
      {insertModalOpen && currentTable && (
        <RowFormPanel mode="insert" columns={columns} onClose={() => setInsertModalOpen(false)} onSubmit={handleInsertRow} />
      )}
      {editingRow && currentTable && (
        <RowFormPanel
          mode="edit"
          columns={columns}
          initialRow={editingRow}
          onClose={() => setEditingRow(null)}
          onSubmit={handleEditRowSubmit}
        />
      )}
    </div>
  );
}
