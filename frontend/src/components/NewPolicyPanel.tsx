import { useState } from 'react';
import { SidePanel } from './SidePanel';
import { POLICY_COMMANDS, type PolicyCommand } from '../types';

interface NewPolicyPanelProps {
  onClose: () => void;
  onCreate: (values: {
    name: string;
    command: PolicyCommand;
    roles?: string[];
    using?: string;
    withCheck?: string;
  }) => Promise<void>;
}

function needsUsing(command: PolicyCommand): boolean {
  return command !== 'INSERT';
}

function needsWithCheck(command: PolicyCommand): boolean {
  return command === 'INSERT' || command === 'UPDATE' || command === 'ALL';
}

export function NewPolicyPanel({ onClose, onCreate }: NewPolicyPanelProps) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState<PolicyCommand>('ALL');
  const [roles, setRoles] = useState('');
  const [using, setUsing] = useState('true');
  const [withCheck, setWithCheck] = useState('true');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Policy name is required');
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        command,
        roles: roles.trim()
          ? roles
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean)
          : undefined,
        using: needsUsing(command) && using.trim() ? using.trim() : undefined,
        withCheck: needsWithCheck(command) && withCheck.trim() ? withCheck.trim() : undefined,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      title="New policy"
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
            {saving ? 'Creating…' : 'Create policy'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-text-subtle">Policy name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. users_select_own"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-subtle">Applies to (command)</label>
          <select
            value={command}
            onChange={(e) => setCommand(e.target.value as PolicyCommand)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-accent"
          >
            {POLICY_COMMANDS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-subtle">Roles</label>
          <input
            value={roles}
            onChange={(e) => setRoles(e.target.value)}
            placeholder="public (default) — or comma-separated role names"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none placeholder:text-text-subtle focus:border-accent"
          />
        </div>

        {needsUsing(command) && (
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-text-subtle">
              <span>USING expression</span>
              <span className="text-[10px]">rows visible to this policy</span>
            </label>
            <textarea
              value={using}
              onChange={(e) => setUsing(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-text outline-none focus:border-accent"
            />
          </div>
        )}

        {needsWithCheck(command) && (
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-text-subtle">
              <span>WITH CHECK expression</span>
              <span className="text-[10px]">rows allowed to be written</span>
            </label>
            <textarea
              value={withCheck}
              onChange={(e) => setWithCheck(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-text outline-none focus:border-accent"
            />
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </SidePanel>
  );
}
