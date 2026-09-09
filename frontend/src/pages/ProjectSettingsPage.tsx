import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Database, Plug, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '../components/Toast';
import { DetailPageSkeleton } from '../components/Skeleton';
import { ConnectionPanel } from '../components/ConnectionPanel';
import { api } from '../lib/api';
import type { Project } from '../types';

export function ProjectSettingsPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  if (!projectIdParam) throw new Error('ProjectSettingsPage rendered without a projectId route param');
  const projectId: string = projectIdParam;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    api
      .getProject(projectId)
      .then((p) => {
        setProject(p);
        setName(p.name);
      })
      .catch(() => {
        toast.error('Project not found');
        navigate('/dashboard', { replace: true });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProject(projectId, name.trim());
      setProject(updated);
      toast.success('Project name updated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Could not copy'),
    );
  }

  async function handleRegeneratePassword() {
    if (!confirm('Generate a new password? The old one will stop working immediately.')) return;
    setRegenerating(true);
    try {
      const { password } = await api.regeneratePassword(projectId);
      setRevealedPassword(password);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}"? This only removes it from Kernabase — the underlying database is untouched unless it's a managed one.`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteProject(projectId);
      toast.success(`Project "${project.name}" deleted`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <div className="h-14 shrink-0 border-b border-border" />
        <DetailPageSkeleton cards={2} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-5">
        <Link
          to={`/projects/${projectId}`}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-text-subtle transition-colors hover:bg-overlay-3 hover:text-text"
          title="Back to project"
        >
          <ChevronLeft size={14} />
          <Database size={16} className="text-accent" />
        </Link>
        <span className="text-sm font-medium tracking-tight text-text">{project.name}</span>
        <span className="text-text-subtle">/</span>
        <span className="text-sm text-text-dim">Settings</span>
      </header>

      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-6 py-8">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-medium text-text">General</h2>
          <label className="mb-1 block text-xs text-text-subtle">Project name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
            <button
              onClick={handleSave}
              disabled={saving || name.trim() === project.name}
              className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-medium text-text">Connection</h2>
          <p className="mb-4 text-xs text-text-subtle">
            Use these to connect your own backend (NestJS, Express, anything with a Postgres client) to this
            database.
          </p>

          {project.isManaged && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-overlay-2 px-3 py-2 text-[11px] text-text-subtle">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
              Managed by Kernabase — its own isolated Postgres role and database, created automatically for your
              account.
            </div>
          )}

          <div className="space-y-2 font-mono text-xs text-text-dim">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-text-subtle">host:</span> {project.host}
              </span>
              <button onClick={() => copy(project.host)} className="shrink-0 text-text-subtle hover:text-text">
                <Copy size={12} />
              </button>
            </div>
            <div>
              <span className="text-text-subtle">port:</span> {project.port}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-text-subtle">database:</span> {project.database}
              </span>
              <button onClick={() => copy(project.database)} className="shrink-0 text-text-subtle hover:text-text">
                <Copy size={12} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-text-subtle">user:</span> {project.dbUser}
              </span>
              <button onClick={() => copy(project.dbUser)} className="shrink-0 text-text-subtle hover:text-text">
                <Copy size={12} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-text-subtle">password:</span>{' '}
                {revealedPassword ?? (project.isManaged ? '(hidden — regenerate to get a usable one)' : '(the one you set)')}
              </span>
              {revealedPassword && (
                <button
                  onClick={() => copy(revealedPassword)}
                  className="shrink-0 text-text-subtle hover:text-text"
                >
                  <Copy size={12} />
                </button>
              )}
            </div>
          </div>

          {project.isManaged ? (
            <>
              <button
                onClick={handleRegeneratePassword}
                disabled={regenerating}
                className="mt-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-dim transition hover:bg-overlay-3 hover:text-text disabled:opacity-50"
              >
                <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
                {regenerating ? 'Generating…' : revealedPassword ? 'Regenerate again' : 'Regenerate password'}
              </button>
              {revealedPassword && (
                <p className="mt-2 text-[11px] text-warn">
                  Copy this now — it's shown once and can't be retrieved again (only regenerated).
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-[11px] text-text-subtle">
              To change these, delete this project and create a new one with updated details.
            </p>
          )}
        </div>

        <ConnectionPanel
          connection={project.connection}
          isManaged={project.isManaged}
          revealedPassword={revealedPassword}
          onRotatePassword={handleRegeneratePassword}
          rotating={regenerating}
        />

        <Link
          to={`/projects/${projectId}/mcp`}
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-5 transition hover:border-accent/40"
        >
          <div>
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-text">
              <Plug size={14} className="text-accent" /> MCP access
            </h2>
            <p className="text-xs text-text-subtle">
              {project.mcpEnabled
                ? `Connected — ${[project.mcpAllowWrite && 'write', project.mcpAllowSchema && 'schema'].filter(Boolean).join(' + ') || 'read-only'}`
                : 'Let an AI tool (Claude Desktop, Claude Code, Cursor, …) connect to this database'}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-text-subtle" />
        </Link>

        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-5">
          <h2 className="mb-1 text-sm font-medium text-danger">Danger zone</h2>
          <p className="mb-4 text-xs text-text-subtle">
            {project.isManaged
              ? 'Deleting this project also drops its managed database — this cannot be undone.'
              : 'This only removes the saved connection from Kernabase; your actual database is untouched.'}
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger transition hover:bg-danger/10 disabled:opacity-50"
          >
            <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  );
}
