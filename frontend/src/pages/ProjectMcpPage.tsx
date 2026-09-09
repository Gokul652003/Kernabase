import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, ChevronLeft, Copy, Database, Plug, RefreshCw } from 'lucide-react';
import { useToast } from '../components/Toast';
import { McpClientSetup } from '../components/McpClientSetup';
import { DetailPageSkeleton } from '../components/Skeleton';
import { api } from '../lib/api';
import type { Project } from '../types';

const READ_TOOLS = ['list_schemas', 'list_tables', 'describe_table', 'query_rows'];
const WRITE_TOOLS = ['insert_row', 'update_row', 'delete_row'];
// Destructive tools are called out so granting the toggle is an informed choice.
const SCHEMA_TOOLS = [
  'create_table',
  'rename_table',
  'add_column',
  'alter_column',
  'create_schema',
  'drop_column*',
  'drop_table*',
  'drop_schema*',
];

function ToolList({ tools }: { tools: string[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {tools.map((tool) => {
        const destructive = tool.endsWith('*');
        return (
          <span
            key={tool}
            title={destructive ? 'Destructive — permanently removes data' : undefined}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
              destructive ? 'bg-danger/10 text-danger' : 'bg-overlay-2 text-text-subtle'
            }`}
          >
            {destructive ? tool.slice(0, -1) : tool}
          </span>
        );
      })}
    </div>
  );
}

export function ProjectMcpPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  if (!projectIdParam) throw new Error('ProjectMcpPage rendered without a projectId route param');
  const projectId: string = projectIdParam;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  useEffect(() => {
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => {
        toast.error('Project not found');
        navigate('/dashboard', { replace: true });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Could not copy'),
    );
  }

  async function handleGenerate() {
    if (project?.mcpEnabled && !confirm('Generate a new MCP token? The old one will stop working immediately.')) return;
    setGenerating(true);
    try {
      const { token } = await api.generateMcpToken(projectId);
      setRevealedToken(token);
      setProject((p) => (p ? { ...p, mcpEnabled: true } : p));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    if (!confirm('Revoke MCP access? Any connected AI tool will stop working until you generate a new token.')) return;
    setRevoking(true);
    try {
      await api.revokeMcpToken(projectId);
      setRevealedToken(null);
      setProject((p) => (p ? { ...p, mcpEnabled: false } : p));
      toast.success('MCP token revoked');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRevoking(false);
    }
  }

  async function handleTogglePermission(key: 'mcpAllowWrite' | 'mcpAllowSchema') {
    if (!project) return;
    const next = {
      allowWrite: key === 'mcpAllowWrite' ? !project.mcpAllowWrite : project.mcpAllowWrite,
      allowSchema: key === 'mcpAllowSchema' ? !project.mcpAllowSchema : project.mcpAllowSchema,
    };
    setSavingPermissions(true);
    try {
      const updated = await api.updateMcpPermissions(projectId, next.allowWrite, next.allowSchema);
      setProject(updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPermissions(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <div className="h-14 shrink-0 border-b border-border" />
        <DetailPageSkeleton cards={3} />
      </div>
    );
  }

  if (!project) return null;

  const mcpUrl = `${window.location.origin}/api/projects/${projectId}/mcp`;
  const serverName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kernabase';

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-5">
        <Link
          to={`/projects/${projectId}/settings`}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-text-subtle transition-colors hover:bg-overlay-3 hover:text-text"
          title="Back to settings"
        >
          <ChevronLeft size={14} />
          <Database size={16} className="text-accent" />
        </Link>
        <span className="text-sm font-medium tracking-tight text-text">{project.name}</span>
        <span className="text-text-subtle">/</span>
        <span className="flex items-center gap-1.5 text-sm text-text-dim">
          <Plug size={13} /> MCP access
        </span>
      </header>

      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-6 py-8">
        <p className="mb-4 text-xs text-text-subtle">
          Let an AI tool (Claude Desktop, Claude Code, Cursor, …) connect to this database through the Model
          Context Protocol. Anyone with the token below can act on this database as allowed by the permissions you
          grant it, so treat it like a password.
        </p>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-medium text-text">Connection</h2>

          <div className="flex items-center justify-between gap-2 font-mono text-xs text-text-dim">
            <span className="truncate">
              <span className="text-text-subtle">url:</span> {mcpUrl}
            </span>
            <button onClick={() => copy(mcpUrl)} className="shrink-0 text-text-subtle hover:text-text">
              <Copy size={12} />
            </button>
          </div>

          {revealedToken && (
            <div className="mt-2 flex items-center justify-between gap-2 font-mono text-xs text-text-dim">
              <span className="truncate">
                <span className="text-text-subtle">token:</span> {revealedToken}
              </span>
              <button onClick={() => copy(revealedToken)} className="shrink-0 text-text-subtle hover:text-text">
                <Copy size={12} />
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-dim transition hover:bg-overlay-3 hover:text-text disabled:opacity-50"
            >
              <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating…' : project.mcpEnabled ? 'Regenerate token' : 'Generate token'}
            </button>
            {project.mcpEnabled && (
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-dim transition hover:bg-overlay-3 hover:text-text disabled:opacity-50"
              >
                <Ban size={13} />
                {revoking ? 'Revoking…' : 'Revoke access'}
              </button>
            )}
          </div>

          {revealedToken ? (
            <p className="mt-2 text-[11px] text-warn">
              Copy this now — it's shown once and can't be retrieved again (only regenerated).
            </p>
          ) : (
            !project.mcpEnabled && (
              <p className="mt-2 text-[11px] text-text-subtle">
                Not connected yet — generate a token to enable MCP access for this project.
              </p>
            )
          )}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-medium text-text">Permissions</h2>
          <p className="mb-4 text-xs text-text-subtle">
            What the connected AI tool is allowed to do, and exactly which tools each grant unlocks. Reading data
            and browsing the schema is always available once MCP is enabled.
          </p>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-bg px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-text">Read</p>
                <span className="shrink-0 rounded-full bg-overlay-2 px-2 py-0.5 text-[10px] text-text-subtle">
                  Always on
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                List schemas and tables, describe columns, query rows with filters and sorting.
              </p>
              <ToolList tools={READ_TOOLS} />
            </div>

            <label className="block cursor-pointer rounded-md border border-border bg-bg px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-text">Write rows</p>
                <input
                  type="checkbox"
                  checked={project.mcpAllowWrite}
                  disabled={savingPermissions}
                  onChange={() => handleTogglePermission('mcpAllowWrite')}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </div>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                Insert, update and delete rows in existing tables. Does not change the table structure.
              </p>
              <ToolList tools={WRITE_TOOLS} />
            </label>

            <label className="block cursor-pointer rounded-md border border-border bg-bg px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-text">Schema changes</p>
                <input
                  type="checkbox"
                  checked={project.mcpAllowSchema}
                  disabled={savingPermissions}
                  onChange={() => handleTogglePermission('mcpAllowSchema')}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </div>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                Create, alter and drop tables, columns and schemas. Altering or dropping a column rewrites or
                destroys the data in it.
              </p>
              <ToolList tools={SCHEMA_TOOLS} />
            </label>
          </div>

          <p className="mt-3 text-[11px] text-text-subtle">
            Raw SQL and privilege changes (GRANT/REVOKE) are never exposed over MCP, whatever you grant here.
          </p>
        </div>

        {(revealedToken || project.mcpEnabled) && (
          <McpClientSetup serverName={serverName} url={mcpUrl} token={revealedToken} />
        )}
      </div>
    </div>
  );
}
