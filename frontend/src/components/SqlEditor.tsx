import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { Play } from 'lucide-react';
import { api } from '../lib/api';
import { TableSkeleton } from './Skeleton';
import type { SqlResult } from '../types';

const darkEditorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#111114', height: '160px', fontSize: '13px' },
    '.cm-content': { caretColor: '#10b981' },
    '.cm-gutters': { backgroundColor: '#111114', color: '#6b7280', border: 'none' },
    '.cm-activeLine': { backgroundColor: '#17171c' },
    '.cm-activeLineGutter': { backgroundColor: '#17171c' },
  },
  { dark: true },
);

const lightEditorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#f6f7f8', height: '160px', fontSize: '13px' },
    '.cm-content': { caretColor: '#059669' },
    '.cm-gutters': { backgroundColor: '#f6f7f8', color: '#8a94a0', border: 'none' },
    '.cm-activeLine': { backgroundColor: '#eceef1' },
    '.cm-activeLineGutter': { backgroundColor: '#eceef1' },
  },
  { dark: false },
);

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface SqlEditorProps {
  onSchemaChange: () => void;
  theme: 'light' | 'dark';
  projectId: string;
}

export function SqlEditor({ onSchemaChange, theme, projectId }: SqlEditorProps) {
  const [query, setQuery] = useState('SELECT * FROM your_table LIMIT 100;');
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await api.runSql(projectId, query);
      setResult(res);
      onSchemaChange();
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <CodeMirror
          value={query}
          height="160px"
          theme={theme === 'dark' ? darkEditorTheme : lightEditorTheme}
          extensions={[sql()]}
          onChange={(value) => setQuery(value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          <Play size={14} /> {running ? 'Running…' : 'Run'}
        </button>
        <span className="text-xs text-text-subtle">⌘/Ctrl + Enter to run</span>
        {result && <span className="font-mono text-xs text-text-subtle">{result.rowCount} row(s)</span>}
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex-1 overflow-auto rounded-lg border border-border">
        {running ? (
          <div className="p-3">
            <TableSkeleton columns={4} rows={6} />
          </div>
        ) : result && result.fields.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-bg/95 backdrop-blur-md">
              <tr>
                {result.fields.map((f) => (
                  <th
                    key={f}
                    className="border-b border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-text-dim"
                  >
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row, i) => (
                <tr key={i} className="hover:bg-overlay-1">
                  {result.fields.map((f) => (
                    <td key={f} className="max-w-[280px] truncate border-b border-border px-3 py-1.5">
                      {formatCell(row[f])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            {result ? 'Query executed successfully. No rows returned.' : 'Results will appear here.'}
          </div>
        )}
      </div>
    </div>
  );
}
