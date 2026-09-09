import { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';

interface McpClientSetupProps {
  serverName: string;
  url: string;
  /** The real token once generated, or null while it is hidden. */
  token: string | null;
}

type ClientId = 'claude-code' | 'cursor' | 'codex' | 'claude-desktop';

interface Step {
  /** Where this goes: a file path, a menu path, or "run this". */
  where: string;
  language: 'bash' | 'json' | 'toml';
  code: string;
}

interface ClientGuide {
  id: ClientId;
  label: string;
  steps: Step[];
  /** Shown as a warning box — things that will silently not work otherwise. */
  caveats?: string[];
  docs: string;
}

const TABS: { id: ClientId; label: string }[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'codex', label: 'Codex' },
  { id: 'claude-desktop', label: 'Claude Desktop' },
];

function guides(serverName: string, url: string, token: string, isLocal: boolean): Record<ClientId, ClientGuide> {
  const authHeader = `Authorization: Bearer ${token}`;

  return {
    'claude-code': {
      id: 'claude-code',
      label: 'Claude Code',
      docs: 'https://code.claude.com/docs/en/mcp',
      steps: [
        {
          where: 'Run in your terminal',
          language: 'bash',
          code: `claude mcp add --transport http ${serverName} ${url} \\\n  --header "${authHeader}"`,
        },
        {
          where: 'Or commit it to your repo as .mcp.json',
          language: 'json',
          code: JSON.stringify(
            {
              mcpServers: {
                [serverName]: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } },
              },
            },
            null,
            2,
          ),
        },
      ],
      caveats: [
        'A committed .mcp.json is shared with everyone who clones the repo — use the CLI command instead unless the token is meant to be shared.',
      ],
    },

    cursor: {
      id: 'cursor',
      label: 'Cursor',
      docs: 'https://cursor.com/docs/context/mcp',
      steps: [
        {
          where: '~/.cursor/mcp.json  (all projects)  or  .cursor/mcp.json  (this project only)',
          language: 'json',
          code: JSON.stringify(
            {
              mcpServers: {
                [serverName]: { url, headers: { Authorization: `Bearer ${token}` } },
              },
            },
            null,
            2,
          ),
        },
      ],
      caveats: [
        'Cursor also accepts "Bearer ${env:KERNABASE_TOKEN}" so the token stays out of the file.',
      ],
    },

    codex: {
      id: 'codex',
      label: 'Codex',
      docs: 'https://learn.chatgpt.com/docs/extend/mcp?surface=cli',
      steps: [
        {
          where: '~/.codex/config.toml',
          language: 'toml',
          code: `[mcp_servers.${serverName.replace(/-/g, '_')}]\nurl = "${url}"\nhttp_headers = { "Authorization" = "Bearer ${token}" }`,
        },
        {
          where: 'Or keep the token in an environment variable instead',
          language: 'toml',
          code: `[mcp_servers.${serverName.replace(/-/g, '_')}]\nurl = "${url}"\nbearer_token_env_var = "KERNABASE_TOKEN"`,
        },
      ],
      caveats: ['Codex uses TOML, and its server keys cannot contain dashes — underscores are used above.'],
    },

    'claude-desktop': {
      id: 'claude-desktop',
      label: 'Claude Desktop',
      docs: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
      steps: [
        {
          where: 'claude_desktop_config.json — macOS: ~/Library/Application Support/Claude/ · Windows: %APPDATA%\\Claude\\',
          language: 'json',
          code: JSON.stringify(
            {
              mcpServers: {
                [serverName]: {
                  command: 'npx',
                  args: ['-y', 'mcp-remote', url, '--header', authHeader],
                },
              },
            },
            null,
            2,
          ),
        },
      ],
      caveats: [
        'Settings → Connectors → Add custom connector does NOT work here: it expects OAuth, and this server authenticates with a bearer token.',
        'That path also connects from Anthropic\'s servers rather than your machine, so it could never reach a local or private-network URL.',
        'The mcp-remote bridge above runs on your machine, so it works for both. It needs Node installed.',
        ...(isLocal
          ? ['This server is on a local address, which is exactly why the connector path cannot be used.']
          : []),
      ],
    },
  };
}

function CodeBlock({ code, onCopy, copied }: { code: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="relative">
      <button
        onClick={onCopy}
        title="Copy"
        className="absolute right-1.5 top-1.5 rounded border border-border bg-surface p-1 text-text-subtle transition-colors hover:text-text"
      >
        {copied ? <Check size={11} className="text-accent" /> : <Copy size={11} />}
      </button>
      <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 pr-9 text-[11px] leading-relaxed text-text-dim">
        {code}
      </pre>
    </div>
  );
}

export function McpClientSetup({ serverName, url, token }: McpClientSetupProps) {
  const [active, setActive] = useState<ClientId>('claude-code');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // A private address is reachable by tools running on this machine, but not by anything
  // that connects from a vendor's servers — which changes the advice for Claude Desktop.
  const isLocal = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[?::1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url);
  const guide = guides(serverName, url, token ?? '<your-token>', isLocal)[active];

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-1 text-sm font-medium text-text">Connect your AI tool</h2>
      <p className="mb-3 text-[11px] text-text-subtle">
        {token
          ? 'Your token is filled in below. Pick your tool and copy the config.'
          : 'Generate a token above to fill these in — the snippets show <your-token> until you do.'}
      </p>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition-colors ${
              active === tab.id
                ? 'border-accent font-medium text-text'
                : 'border-transparent text-text-subtle hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {guide.steps.map((step, index) => (
          <div key={index}>
            <p className="mb-1.5 font-mono text-[10px] text-text-subtle">{step.where}</p>
            <CodeBlock
              code={step.code}
              copied={copiedKey === `${guide.id}-${index}`}
              onCopy={() => copy(`${guide.id}-${index}`, step.code)}
            />
          </div>
        ))}

        {guide.caveats && guide.caveats.length > 0 && (
          <div className="flex gap-2 rounded-md border border-warn/30 bg-warn/5 px-3 py-2.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />
            <ul className="flex flex-col gap-1 text-[11px] text-text-dim">
              {guide.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-text-subtle">
          Restart {guide.label} after editing its config.{' '}
          <a href={guide.docs} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {guide.label} MCP docs ↗
          </a>
        </p>
      </div>
    </div>
  );
}
