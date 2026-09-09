import { ProjectConnectionInfo } from '@/db/tenant/database.ports';

export { PROJECT_POOL_INVALIDATOR, type ProjectPoolInvalidator } from '@/db/tenant/database.ports';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');
export const DATABASE_CONNECTION_TESTER = Symbol('DATABASE_CONNECTION_TESTER');
export const MANAGED_DATABASE_ADMIN = Symbol('MANAGED_DATABASE_ADMIN');

export interface StoredUser {
  id: string;
  email: string;
}

export interface StoredUserWithPassword extends StoredUser {
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUserWithPassword | null>;
  findById(id: string): Promise<StoredUser | null>;
  createUser(email: string, passwordHash: string): Promise<StoredUser>;
  deleteById(id: string): Promise<void>;
}

export interface ProjectRecord {
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

export interface NewProjectRecord {
  name: string;
  host: string;
  port: number;
  database: string;
  dbUser: string;
  dbPassword: string;
}

export interface ManagedProjectResource {
  database: string;
  dbUser: string;
  isManaged: boolean;
}

export interface McpCredentialRecord {
  ownerId: string;
  tokenHash: string | null;
  allowWrite: boolean;
  allowSchema: boolean;
}

export interface ProjectRepository {
  listOwned(userId: string): Promise<ProjectRecord[]>;
  /** Used to enforce the per-user managed-database quota. */
  countManaged(userId: string): Promise<number>;
  createProject(userId: string, project: NewProjectRecord, isManaged: boolean): Promise<ProjectRecord>;
  findOwned(projectId: string, userId: string): Promise<ProjectRecord | null>;
  rename(projectId: string, userId: string, name: string): Promise<ProjectRecord | null>;
  findOwnedResource(projectId: string, userId: string): Promise<ManagedProjectResource | null>;
  deleteOwned(projectId: string, userId: string): Promise<boolean>;
  updatePassword(projectId: string, password: string): Promise<void>;
  connectionInfo(projectId: string, userId: string): Promise<ProjectConnectionInfo | null>;
  setMcpTokenHash(projectId: string, userId: string, tokenHash: string | null): Promise<boolean>;
  setMcpPermissions(projectId: string, userId: string, allowWrite: boolean, allowSchema: boolean): Promise<ProjectRecord | null>;
  findMcpCredential(projectId: string): Promise<McpCredentialRecord | null>;
}

export interface DatabaseConnectionTester {
  assertConnectable(project: NewProjectRecord): Promise<void>;
}

export interface ManagedDatabaseAdmin {
  createRole(role: string, password: string): Promise<void>;
  createDatabase(database: string, ownerRole: string): Promise<void>;
  changeRolePassword(role: string, password: string): Promise<void>;
  dropDatabase(database: string): Promise<void>;
  dropRole(role: string): Promise<void>;
}

