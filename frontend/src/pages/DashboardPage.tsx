import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, LogOut, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { NewProjectPanel } from '../components/NewProjectPanel';
import { RefreshButton } from '../components/RefreshButton';
import { ProjectCardsSkeleton } from '../components/Skeleton';
import { api } from '../lib/api';
import type { NewProjectDraft, Project } from '../types';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(draft: NewProjectDraft) {
    const project = await api.createProject(draft);
    setModalOpen(false);
    toast.success(`Project "${project.name}" created`);
    await load();
    navigate(`/projects/${project.id}`);
  }

  async function handleDelete(e: React.MouseEvent, project: Project) {
    e.stopPropagation();
    const consequence = project.isManaged
      ? 'Its managed database and all data in it will be permanently deleted.'
      : 'This only removes it from Kernabase — your external database is untouched.';
    if (!confirm(`Delete project "${project.name}"? ${consequence}`)) return;
    try {
      await api.deleteProject(project.id);
      toast.success(`Project "${project.name}" removed`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2.5">
          <Database size={16} className="text-accent" />
          <span className="text-sm font-medium tracking-tight text-text">Kernabase</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-subtle">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-dim transition-colors hover:bg-overlay-3 hover:text-text"
          >
            <LogOut size={13} /> Log out
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-text">Projects</h1>
            <p className="text-xs text-text-subtle">Create a managed database or connect one you already have.</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onClick={() => void load()} busy={loading} label="Refresh projects" showLabel />
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg shadow-sm transition hover:brightness-110"
            >
              <Plus size={16} /> New project
            </button>
          </div>
        </div>

        {loading && projects.length === 0 && <ProjectCardsSkeleton />}

        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center text-sm text-text-dim">
            <Database size={24} className="text-text-subtle" />
            No projects yet — create your first database.
          </div>
        )}

        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="group flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-overlay-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Database size={15} className="shrink-0 text-accent" />
                  <span className="truncate text-sm font-medium text-text">{p.name}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, p)}
                  className="shrink-0 rounded p-1 text-text-subtle opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {p.isManaged ? (
                <span className="w-fit rounded border border-border bg-overlay-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-subtle">
                  Managed
                </span>
              ) : (
                <div
                  className="truncate font-mono text-[11px] text-text-subtle"
                  title={`${p.dbUser}@${p.host}:${p.port}/${p.database}`}
                >
                  {p.dbUser}@{p.host}:{p.port}/{p.database}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {modalOpen && <NewProjectPanel onClose={() => setModalOpen(false)} onCreate={handleCreate} />}
    </div>
  );
}
