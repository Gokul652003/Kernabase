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
}
