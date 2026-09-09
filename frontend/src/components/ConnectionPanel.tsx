import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Lock, TerminalSquare } from 'lucide-react';
import type { ProjectConnectionTarget } from '../types';

interface ConnectionPanelProps {
  connection: ProjectConnectionTarget | null;
  isManaged: boolean;
  /** Shown once, immediately after the user rotates it. Never retrievable later. */
  revealedPassword: string | null;
  onRotatePassword: () => void;
  rotating: boolean;
}

type Tab = 'uri' | 'psql' | 'node';

const TABS: { id: Tab; label: string }[] = [
  { id: 'uri', label: 'Connection string' },
  { id: 'psql', label: 'psql' },
  { id: 'node', label: 'Node.js' },
];

/**
 * A password is percent-encoded before going into a URI: the generated ones are
 * base64url and safe, but a rotated or user-supplied password containing `@`, `:` or
 * `/` would otherwise silently produce a URI that parses to the wrong host.
 */
function buildUri(target: ProjectConnectionTarget, password: string): string {
  const user = encodeURIComponent(target.user);
  const secret = encodeURIComponent(password);
  return `postgresql://${user}:${secret}@${target.host}:${target.port}/${target.database}?sslmode=verify-full`;
}

function snippet(tab: Tab, target: ProjectConnectionTarget, password: string): string {
  switch (tab) {
    case 'uri':
      return buildUri(target, password);
    case 'psql':
      return `psql "${buildUri(target, password)}"`;
    case 'node':
      return [
        `import { Pool } from 'pg';`,
        ``,
        `const pool = new Pool({`,
        `  host: '${target.host}',`,
        `  port: ${target.port},`,
        `  database: '${target.database}',`,
        `  user: '${target.user}',`,
        `  password: process.env.DATABASE_PASSWORD,`,
        `  // verify-full checks the server is who it claims to be, not just that the`,
        `  // connection is encrypted.`,
        `  ssl: { rejectUnauthorized: true },`,
        `});`,
      ].join('\n');
  }
}

export function ConnectionPanel({
  connection,
  isManaged,
  revealedPassword,
  onRotatePassword,
  rotating,
}: ConnectionPanelProps) {
  const [tab, setTab] = useState<Tab>('uri');
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  if (!connection) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-text">
          <TerminalSquare size={14} /> Connect your app
        </h2>
        <p className="text-[11px] text-text-subtle">
          This database is reachable through the studio and MCP only — it is not exposed to the internet, so there is
          no address to connect an external client to.
        </p>
      </div>
    );
  }

  const placeholder = '<your-password>';
  const password = revealedPassword ?? placeholder;
  const text = snippet(tab, connection, password);
  // Masking only matters once a real secret is on screen.
  const display = revealedPassword && !showSecret ? text.split(revealedPassword).join('••••••••') : text;

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-text">
        <TerminalSquare size={14} /> Connect your app
      </h2>
      <p className="mb-3 text-[11px] text-text-subtle">
        Use these from psql, pgAdmin, DBeaver, Prisma, or any Postgres client.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-[11px] text-text-dim">
        <span><span className="text-text-subtle">host</span> {connection.host}</span>
        <span><span className="text-text-subtle">port</span> {connection.port}</span>
        <span className="truncate"><span className="text-text-subtle">database</span> {connection.database}</span>
        <span className="truncate"><span className="text-text-subtle">user</span> {connection.user}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition-colors ${
              tab === entry.id ? 'border-accent font-medium text-text' : 'border-transparent text-text-subtle hover:text-text'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          {revealedPassword && (
            <button
              onClick={() => setShowSecret((value) => !value)}
              title={showSecret ? 'Hide password' : 'Show password'}
              className="rounded border border-border bg-surface p-1 text-text-subtle hover:text-text"
            >
              {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          )}
          <button
            onClick={copy}
            title="Copy"
            className="rounded border border-border bg-surface p-1 text-text-subtle hover:text-text"
          >
            {copied ? <Check size={11} className="text-accent" /> : <Copy size={11} />}
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-bg p-3 pr-16 text-[11px] leading-relaxed text-text-dim">
          {display}
        </pre>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-text-subtle">
        <Lock size={11} className="mt-0.5 shrink-0" />
        <span>
          <code className="text-text-dim">sslmode=verify-full</code> encrypts the connection and checks the server's
          identity. Do not lower it to <code className="text-text-dim">disable</code>.
        </span>
      </p>

      {isManaged && (
        <div className="mt-3 border-t border-border pt-3">
          {revealedPassword ? (
            <p className="text-[11px] text-warn">
              Copy this now — the password is shown once and cannot be retrieved again, only rotated.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-text-subtle">
                The password is stored encrypted and never shown again after it is created. Rotate it to get a usable
                one — anything already connected with the old password will stop working.
              </p>
              <button
                onClick={onRotatePassword}
                disabled={rotating}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-text-dim transition hover:bg-overlay-3 hover:text-text disabled:opacity-50"
              >
                {rotating ? 'Rotating…' : 'Rotate password'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
