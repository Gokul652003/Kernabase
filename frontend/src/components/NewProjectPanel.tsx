import { useState } from 'react';
import { SidePanel } from './SidePanel';
import { DEFAULT_POSTGRES_PORT, type NewProjectDraft } from '../types';

interface NewProjectPanelProps {
  onClose: () => void;
  onCreate: (draft: NewProjectDraft) => Promise<void>;
}

export function NewProjectPanel({ onClose, onCreate }: NewProjectPanelProps) {
  const [mode, setMode] = useState<'managed' | 'existing'>('managed');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  // Prefilled rather than placeheld: a greyed-out "5432" reads as already filled in,
  // so submitting failed validation on a field the user believed they had answered.
  const [port, setPort] = useState(String(DEFAULT_POSTGRES_PORT));
  const [database, setDatabase] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    if (mode === 'managed') {
      setSaving(true);
      try {
        await onCreate({ mode, name: name.trim() });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!host.trim() || !database.trim() || !dbUser.trim()) {
      setError('All fields except password are required');
      return;
    }
    const portNum = port.trim() === '' ? DEFAULT_POSTGRES_PORT : Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setError('Port must be a whole number between 1 and 65535');
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        mode,
        name: name.trim(),
        host: host.trim(),
        port: portNum,
        database: database.trim(),
        dbUser: dbUser.trim(),
        dbPassword,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="New project"
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
            {saving ? (mode === 'managed' ? 'Creating…' : 'Connecting…') : 'Create project'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 rounded-md border border-border bg-overlay-1 p-1">
          <button
            type="button"
            onClick={() => { setMode('managed'); setError(null); }}
            className={`rounded px-3 py-2 text-xs font-medium transition-colors ${mode === 'managed' ? 'bg-surface text-text shadow-sm' : 'text-text-subtle hover:text-text'}`}
          >
            Create a database
          </button>
          <button
            type="button"
            onClick={() => { setMode('existing'); setError(null); }}
            className={`rounded px-3 py-2 text-xs font-medium transition-colors ${mode === 'existing' ? 'bg-surface text-text shadow-sm' : 'text-text-subtle hover:text-text'}`}
          >
            Connect existing
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-subtle">Project name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme production"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        {mode === 'managed' ? (
          <p className="text-xs leading-5 text-text-subtle">
            Kernabase will create and manage a private PostgreSQL database for this project. No connection details needed.
          </p>
        ) : <>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-text-subtle">Host</label>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="e.g. db.example.com"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-subtle">Port</label>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="5432"
              inputMode="numeric"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-subtle">Database</label>
          <input
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder="e.g. postgres"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-subtle">User</label>
            <input
              value={dbUser}
              onChange={(e) => setDbUser(e.target.value)}
              placeholder="postgres"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-subtle">Password</label>
            <input
              type="password"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
            />
          </div>
        </div>

        <p className="text-[11px] text-text-subtle">
          We'll test this connection before saving it. Credentials are encrypted at rest.
        </p>
        </>}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </SidePanel>
  );
}
