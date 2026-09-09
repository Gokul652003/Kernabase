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
