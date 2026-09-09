import { useState } from 'react';
import { SidePanel } from './SidePanel';

interface NewSchemaPanelProps {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function NewSchemaPanel({ onClose, onCreate }: NewSchemaPanelProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Schema name is required');
      return;
    }
    setSaving(true);
    try {
      await onCreate(name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="New schema"
      onClose={onClose}
      widthClassName="w-[380px]"
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
            {saving ? 'Creating…' : 'Create schema'}
          </button>
        </>
      }
    >
      <label className="mb-1 block text-xs text-text-subtle">Schema name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. analytics"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </SidePanel>
  );
}
