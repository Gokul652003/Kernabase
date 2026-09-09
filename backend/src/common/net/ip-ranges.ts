/**
 * Classifies an IP address so a user-supplied database host can be checked before the
 * server dials it.
 *
 * A studio that connects to "any Postgres you name" is a request-forgery primitive: the
 * address is chosen by the user but the connection is made by the server, from inside
 * the trust boundary. Classifying the *resolved* address is the only reliable check —
 * matching on the hostname string is defeated by `127.0.0.1`, `0.0.0.0`, `[::1]`,
 * decimal-encoded IPv4, or any public DNS name pointing at a private address.
 */
export type IpCategory =
  | 'loopback'
  | 'private'
  | 'link-local'
  | 'unique-local'
  | 'carrier-grade-nat'
  | 'unspecified'
  | 'multicast'
  | 'broadcast'
  | 'public';

/**
 * Categories that are never a database, whatever the configuration.
 *
 * `unspecified` routes to localhost, and link-local carries the cloud metadata endpoint
 * (169.254.169.254) — neither is ever a legitimate PostgreSQL target, so no flag opens
 * them.
 */
const ALWAYS_BLOCKED: ReadonlySet<IpCategory> = new Set<IpCategory>([
  'link-local',
  'unspecified',
  'multicast',
  'broadcast',
]);

/**
 * Reachable-but-internal: blocked on a shared deployment, allowed on a self-hosted one.
 *
 * Loopback belongs here rather than in ALWAYS_BLOCKED because a single-user install
 * routinely runs its databases on the same machine as the studio. What protects the
 * control plane is the exact-target check in ConnectionTargetPolicy, not a blanket ban
 * on the address range it happens to sit in.
 */
const INTERNAL: ReadonlySet<IpCategory> = new Set<IpCategory>([
  'loopback',
  'private',
  'unique-local',
  'carrier-grade-nat',
]);

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function categorizeIpv4(octets: number[]): IpCategory {
  const [a = 0, b = 0, c = 0, d = 0] = octets;
  if (a === 0) return 'unspecified';
  if (a === 127) return 'loopback';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 100 && b >= 64 && b <= 127) return 'carrier-grade-nat';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a === 255 && b === 255 && c === 255 && d === 255) return 'broadcast';
  // 240.0.0.0/4 is reserved; treat it as unusable rather than public.
  if (a >= 240) return 'broadcast';
  return 'public';
}

export function categorizeIp(address: string): IpCategory {
  const trimmed = address.trim().replace(/^\[|\]$/g, '');

  const ipv4 = parseIpv4(trimmed);
  if (ipv4) return categorizeIpv4(ipv4);

  const lower = trimmed.toLowerCase();
  // Strip a zone index (fe80::1%eth0) before classifying.
  const withoutZone = lower.split('%')[0] ?? lower;

  // IPv4-mapped and IPv4-compatible forms must be judged by the address they carry,
  // or ::ffff:127.0.0.1 would sail through as "some IPv6 address".
  const mapped = /^::(ffff:(0:)?)?(\d{1,3}(\.\d{1,3}){3})$/.exec(withoutZone);
  if (mapped?.[3]) {
    const embedded = parseIpv4(mapped[3]);
    if (embedded) return categorizeIpv4(embedded);
  }

  if (withoutZone === '::' || withoutZone === '::0') return 'unspecified';
  if (withoutZone === '::1') return 'loopback';
  if (/^fe[89ab][0-9a-f]:/.test(withoutZone)) return 'link-local';
  if (/^f[cd][0-9a-f]{2}:/.test(withoutZone)) return 'unique-local';
  if (/^ff[0-9a-f]{2}:/.test(withoutZone)) return 'multicast';
  return 'public';
}

/**
 * Canonical form for comparing two addresses.
 *
 * `::ffff:127.0.0.1` and `127.0.0.1` reach the same host, so an exact-target check that
 * compares them as strings would miss the mapped form entirely.
 */
export function normalizeIp(address: string): string {
  const trimmed = address.trim().replace(/^\[|\]$/g, '').toLowerCase();
  const withoutZone = trimmed.split('%')[0] ?? trimmed;
  const mapped = /^::(ffff:(0:)?)?(\d{1,3}(\.\d{1,3}){3})$/.exec(withoutZone);
  if (mapped?.[3] && parseIpv4(mapped[3])) return mapped[3];
  return withoutZone;
}

export function isAlwaysBlocked(category: IpCategory): boolean {
  return ALWAYS_BLOCKED.has(category);
}

export function isInternal(category: IpCategory): boolean {
  return INTERNAL.has(category);
}
