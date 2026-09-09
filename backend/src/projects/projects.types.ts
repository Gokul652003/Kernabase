export interface ProjectSummary {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  dbUser: string;
  isManaged: boolean;
  mcpEnabled: boolean;
  mcpAllowWrite: boolean;
  mcpAllowSchema: boolean;
  createdAt: string;
  /**
   * Where a client outside this server should connect, when that is possible at all.
   * Null means the database is only reachable through the studio and MCP — either
   * PostgreSQL is not published, or no public host has been configured.
   */
  connection: ProjectConnectionTarget | null;
}

export interface ProjectConnectionTarget {
  host: string;
  port: number;
  database: string;
  user: string;
}

/**
 * A newly provisioned project, with its password included exactly once.
 *
 * The password is encrypted at rest and cannot be read back, so if it is not returned
 * here the user's only route to a usable one is rotating a password they never had.
 */
export interface ProvisionedProject {
  project: ProjectSummary;
  password: string;
}
