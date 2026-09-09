import { useCallback, useEffect, useState } from 'react';
import { Lock, LockOpen, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { RefreshButton } from './RefreshButton';
import { PolicyListSkeleton } from './Skeleton';
import { NewPolicyPanel } from './NewPolicyPanel';
import { useToast } from './Toast';
import { api } from '../lib/api';
import type { PolicyCommand, PolicyInfo } from '../types';

interface PoliciesPanelProps {
  tableName: string | null;
  schema: string;
  projectId: string;
}

const COMMAND_STYLE: Record<PolicyCommand, string> = {
  ALL: 'text-violet bg-violet/10 border-violet/20',
  SELECT: 'text-info bg-info/10 border-info/20',
  INSERT: 'text-accent bg-accent/10 border-accent/20',
  UPDATE: 'text-warn bg-warn/10 border-warn/20',
  DELETE: 'text-danger bg-danger/10 border-danger/20',
};

export function PoliciesPanel({ tableName, schema, projectId }: PoliciesPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingRls, setTogglingRls] = useState(false);
  const [newPanelOpen, setNewPanelOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(
    async (table: string) => {
      setLoading(true);
      try {
        const [status, list] = await Promise.all([
          api.getRlsStatus(projectId, table, schema),
          api.listPolicies(projectId, table, schema),
        ]);
        setEnabled(status.enabled);
        setPolicies(list);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [toast, projectId, schema],
  );

  useEffect(() => {
    if (tableName) {
      load(tableName);
    } else {
      setPolicies([]);
      setEnabled(false);
    }
  }, [tableName, load]);

  async function toggleRls() {
    if (!tableName || togglingRls) return;
    setTogglingRls(true);
    const next = !enabled;
    try {
      await api.setRlsEnabled(projectId, tableName, next, schema);
      setEnabled(next);
      toast.success(`Row level security ${next ? 'enabled' : 'disabled'} for "${tableName}"`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTogglingRls(false);
    }
  }

  async function handleCreate(values: {
    name: string;
    command: PolicyCommand;
    roles?: string[];
    using?: string;
    withCheck?: string;
  }) {
    if (!tableName) return;
    await api.createPolicy(projectId, tableName, values, schema);
    setNewPanelOpen(false);
    toast.success(`Policy "${values.name}" created`);
    await load(tableName);
  }

  async function handleDelete(policy: PolicyInfo) {
    if (!tableName) return;
    if (!confirm(`Drop policy "${policy.name}"?`)) return;
    try {
      await api.dropPolicy(projectId, tableName, policy.name, schema);
      toast.success(`Policy "${policy.name}" dropped`);
      await load(tableName);
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  }

  if (!tableName) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
        Select a table to manage its row level security policies.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-overlay-1 px-4 py-3">
        <div className="flex items-center gap-3">
          {enabled ? <Lock size={16} className="text-accent" /> : <LockOpen size={16} className="text-text-subtle" />}
          <div>
            <div className="text-sm font-medium text-text">Row Level Security</div>
            <div className="text-xs text-text-subtle">
              {enabled ? 'Enabled — policies below are enforced.' : 'Disabled — all rows are visible to every role.'}
            </div>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={enabled}
            disabled={togglingRls}
            onChange={toggleRls}
            className="peer sr-only"
          />
          <div className="peer h-4 w-8 rounded-full bg-track-off transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-disabled:opacity-50" />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-subtle">
          Policies{' '}
          {policies.length > 0 && <span className="font-mono normal-case text-text-subtle">({policies.length})</span>}
        </span>
        <div className="flex items-center gap-2">
          <RefreshButton
            onClick={() => tableName && void load(tableName)}
            busy={loading}
            disabled={!tableName}
            label="Refresh policies"
          />
          <button
            onClick={() => setNewPanelOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg shadow-sm hover:brightness-110"
          >
            <Plus size={14} /> New policy
          </button>
        </div>
      </div>

      {loading && policies.length === 0 && <PolicyListSkeleton />}

      {!loading && policies.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-xs text-text-dim">
          <ShieldCheck size={22} className="text-text-subtle" />
          No policies yet — create one to restrict row access.
        </div>
      )}

      <div className={`flex flex-col gap-2 ${loading ? 'opacity-60' : ''}`}>
        {policies.map((p) => (
          <div key={p.name} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text">{p.name}</span>
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${COMMAND_STYLE[p.command]}`}>
                  {p.command}
                </span>
                <span className="text-[10px] text-text-subtle">{p.permissive}</span>
              </div>
              <button
                onClick={() => handleDelete(p)}
                className="rounded p-1 text-text-subtle hover:bg-danger/10 hover:text-danger"
                title="Drop policy"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.roles.map((r) => (
                <span key={r} className="rounded bg-overlay-3 px-1.5 py-0.5 font-mono text-[10px] text-text-subtle">
                  {r}
                </span>
              ))}
            </div>
            {p.using && (
              <div className="mt-2 text-[11px]">
                <span className="text-text-subtle">USING </span>
                <span className="font-mono text-text-dim">{p.using}</span>
              </div>
            )}
            {p.withCheck && (
              <div className="mt-1 text-[11px]">
                <span className="text-text-subtle">WITH CHECK </span>
                <span className="font-mono text-text-dim">{p.withCheck}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {newPanelOpen && <NewPolicyPanel onClose={() => setNewPanelOpen(false)} onCreate={handleCreate} />}
    </div>
  );
}
