import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Database, LogOut, Settings } from 'lucide-react';
import { api } from '../lib/api';
import type { ThemePreference } from '../lib/theme';
import { SchemaSwitcher } from './SchemaSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';

type ConnectionState = 'checking' | 'connected' | 'disconnected';

interface HeaderProps {
  projectId: string;
  projectName: string;
  userEmail?: string;
  onLogout: () => void;
  schemas: string[];
  currentSchema: string;
  onSelectSchema: (schema: string) => void;
  onNewSchema: () => void;
  onRefreshSchemas: () => void;
  schemasLoading?: boolean;
  themePreference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  onThemeChange: (pref: ThemePreference) => void;
}

export function Header({
  projectId,
  projectName,
  userEmail,
  onLogout,
  schemas,
  currentSchema,
  onSelectSchema,
  onNewSchema,
  onRefreshSchemas,
  schemasLoading,
  themePreference,
  resolvedTheme,
  onThemeChange,
}: HeaderProps) {
  const [status, setStatus] = useState<ConnectionState>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const start = performance.now();
      try {
        const res = await api.health();
        if (!cancelled) {
          setStatus(res.ok ? 'connected' : 'disconnected');
          setLatencyMs(res.ok ? Math.round(performance.now() - start) : null);
        }
      } catch {
        if (!cancelled) {
          setStatus('disconnected');
          setLatencyMs(null);
        }
      }
    }

    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          to="/dashboard"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-text-subtle transition-colors hover:bg-overlay-3 hover:text-text"
          title="Back to dashboard"
        >
          <ChevronLeft size={14} />
          <Database size={16} className="text-accent" />
        </Link>
        <span className="truncate text-sm font-medium tracking-tight text-text">{projectName}</span>
        <div className="h-4 w-px shrink-0 bg-border" />
        <SchemaSwitcher
          schemas={schemas}
          currentSchema={currentSchema}
          onSelect={onSelectSchema}
          onNewSchema={onNewSchema}
          onRefresh={onRefreshSchemas}
          loading={schemasLoading}
        />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'connected'
                ? 'bg-accent shadow-[0_0_8px_var(--color-accent-glow)]'
                : status === 'disconnected'
                  ? 'bg-danger'
                  : 'bg-text-subtle'
            }`}
          />
          {status === 'connected' && (
            <span>
              Connected{latencyMs !== null && <span className="text-text-subtle"> · {latencyMs}ms</span>}
            </span>
          )}
          {status === 'disconnected' && <span>Disconnected — check backend &amp; Postgres</span>}
          {status === 'checking' && <span>Connecting…</span>}
        </div>
        <div className="h-4 w-px bg-border" />
        <ThemeSwitcher preference={themePreference} resolvedTheme={resolvedTheme} onChange={onThemeChange} />
        <div className="h-4 w-px bg-border" />
        <Link
          to={`/projects/${projectId}/settings`}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-overlay-3 hover:text-text"
          title="Project settings"
        >
          <Settings size={13} />
        </Link>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-text-subtle">{userEmail}</span>
        <button
          onClick={onLogout}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-overlay-3 hover:text-text"
          title="Log out"
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}
