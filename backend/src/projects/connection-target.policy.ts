import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { ApplicationError } from '@/common/errors/application.error';
import { categorizeIp, isAlwaysBlocked, isInternal, normalizeIp, type IpCategory } from '@/common/net/ip-ranges';
import { AppConfig } from '@/config/app-config.service';

/**
 * Decides whether the server is willing to open a database connection to a
 * user-supplied host.
 *
 * Without this, "add your own Postgres" lets any registered user point the backend at
 * anything it can reach — including the studio's own control-plane database, whose
 * `_studio.users` and `_studio.projects` tables hold every other user's password hash,
 * encrypted database password and MCP token hash. The API's ownership checks do not
 * apply there, because the query goes to PostgreSQL directly rather than through them.
 *
 * There are two distinct rules, and conflating them makes the studio unusable:
 *
 * 1. The control-plane database itself is refused unconditionally. That is an exact
 *    target — same server, same port, same database name — not an address range.
 * 2. Internal address ranges are refused unless the operator opts in. A single-user
 *    install legitimately runs its databases on localhost or a LAN address; a shared
 *    deployment must not let one user reach the other side of its firewall.
 *
 * Only user-supplied targets are checked. Managed provisioning deliberately points at
 * the configured PostgreSQL server and is not routed through here.
 */
@Injectable()
export class ConnectionTargetPolicy {
  private readonly logger = new Logger(ConnectionTargetPolicy.name);
  private controlPlaneAddresses: Promise<Set<string>> | null = null;

  constructor(private readonly config: AppConfig) {}

  async assertAllowed(host: string, port: number, database: string): Promise<void> {
    // Strip the brackets of a URL-style IPv6 literal ("[::1]"): neither net.isIP nor
    // dns.lookup accepts them, so without this the address would be treated as a
    // hostname and refused as unresolvable rather than as loopback.
    const candidate = host.trim().replace(/^\[(.*)\]$/, '$1');
    if (!candidate) throw ApplicationError.badRequest('A database host is required');

    const addresses = await this.resolve(candidate);

    if (await this.isControlPlane(addresses, port, database)) {
      throw ApplicationError.badRequest(
        "Refusing to connect to the studio's own metadata database. Pick a different database on that "
          + 'server, or a different server.',
      );
    }

    for (const address of addresses) {
      const category = categorizeIp(address);
      if (isAlwaysBlocked(category)) {
        throw ApplicationError.badRequest(`Refusing to connect to ${describe(category)} (${address}).`);
      }
      if (isInternal(category) && !this.config.allowPrivateDatabaseHosts) {
        throw ApplicationError.badRequest(
          `Refusing to connect to ${describe(category)} (${address}). If this studio is meant to reach `
            + 'databases on its own machine or network, set ALLOW_PRIVATE_DATABASE_HOSTS=true.',
        );
      }
    }
  }

  /**
   * True only for the exact database this studio stores its own data in. Matching the
   * whole server would block every other database on it, which on a single-machine
   * install is every database the user has.
   */
  private async isControlPlane(addresses: string[], port: number, database: string): Promise<boolean> {
    if (port !== this.config.postgres.port) return false;
    if (database !== this.config.postgres.database) return false;
    const controlPlane = await this.resolveControlPlane();
    return addresses.some((address) => controlPlane.has(normalizeIp(address)));
  }

  /** Resolved once: the control-plane host does not change while the process runs. */
  private resolveControlPlane(): Promise<Set<string>> {
    this.controlPlaneAddresses ??= this.resolve(this.config.postgres.host)
      .then((addresses) => new Set(addresses.map(normalizeIp)))
      .catch(() => new Set<string>());
    return this.controlPlaneAddresses;
  }

  /**
   * Resolves every address a host maps to. All of them must pass — a name that returns
   * both a public and a loopback address must not be accepted on the strength of the
   * public one.
   */
  private async resolve(host: string): Promise<string[]> {
    if (isIP(host)) return [host];
    try {
      const results = await lookup(host, { all: true, verbatim: true });
      if (results.length === 0) throw new Error('no addresses');
      return results.map((result) => result.address);
    } catch (error) {
      this.logger.warn(`Rejected database host ${host}: ${(error as Error).message}`);
      throw ApplicationError.badRequest(`Could not resolve host: ${host}`);
    }
  }
}

function describe(category: IpCategory): string {
  switch (category) {
    case 'loopback':
      return 'a loopback address';
    case 'private':
      return 'a private network address';
    case 'unique-local':
      return 'a unique-local address';
    case 'carrier-grade-nat':
      return 'a carrier-grade NAT address';
    case 'link-local':
      return 'a link-local address';
    case 'unspecified':
      return 'an unspecified address';
    case 'multicast':
      return 'a multicast address';
    case 'broadcast':
      return 'a reserved or broadcast address';
    default:
      return 'that address';
  }
}
