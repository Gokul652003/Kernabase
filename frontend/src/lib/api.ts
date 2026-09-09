import type {
  AddColumnDraft,
  AlterColumnPatch,
  AuthUser,
  ColumnInfo,
  NewColumnDraft,
  NewProjectDraft,
  PolicyInfo,
  Project,
  RlsStatus,
  RowFilter,
  RowsResponse,
  RowSort,
  SqlResult,
  TableInfo,
} from '../types';
import { clearToken, getToken } from './auth';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) clearToken();
    const message = Array.isArray(data?.message) ? data.message.join('; ') : data?.message;
    throw new ApiError(message || `Request failed: ${res.status}`, res.status);
  }
  return data as T;
}

function withSchema(path: string, schema?: string): string {
  if (!schema) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}schema=${encodeURIComponent(schema)}`;
}

export const api = {
  health: () => request<{ ok: boolean; error?: string }>('/health'),

  signup: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<AuthUser>('/auth/me'),

  listProjects: () => request<Project[]>('/projects'),

  createProject: (draft: NewProjectDraft) => {
    if (draft.mode === 'managed') {
      return request<Project>('/projects/managed', {
        method: 'POST',
        body: JSON.stringify({ name: draft.name }),
      });
    }
    const { mode: _mode, ...connection } = draft;
    return request<Project>('/projects', { method: 'POST', body: JSON.stringify(connection) });
  },

  getProject: (projectId: string) => request<Project>(`/projects/${encodeURIComponent(projectId)}`),

  updateProject: (projectId: string, name: string) =>
    request<Project>(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  regeneratePassword: (projectId: string) =>
    request<{ password: string }>(`/projects/${encodeURIComponent(projectId)}/regenerate-password`, {
      method: 'POST',
    }),

  generateMcpToken: (projectId: string) =>
    request<{ token: string }>(`/projects/${encodeURIComponent(projectId)}/mcp-token`, { method: 'POST' }),

  revokeMcpToken: (projectId: string) =>
    request<void>(`/projects/${encodeURIComponent(projectId)}/mcp-token`, { method: 'DELETE' }),

  updateMcpPermissions: (projectId: string, allowWrite: boolean, allowSchema: boolean) =>
    request<Project>(`/projects/${encodeURIComponent(projectId)}/mcp-permissions`, {
      method: 'PUT',
      body: JSON.stringify({ allowWrite, allowSchema }),
    }),

  deleteProject: (projectId: string) =>
    request<void>(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' }),

  listSchemas: (projectId: string) => request<string[]>(`/projects/${encodeURIComponent(projectId)}/schemas`),

  createSchema: (projectId: string, name: string) =>
    request<void>(`/projects/${encodeURIComponent(projectId)}/schemas`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  listTables: (projectId: string, schema?: string) =>
    request<TableInfo[]>(withSchema(`/projects/${encodeURIComponent(projectId)}/tables`, schema)),

  createTable: (projectId: string, name: string, columns: NewColumnDraft[], schema?: string) =>
    request<void>(withSchema(`/projects/${encodeURIComponent(projectId)}/tables`, schema), {
      method: 'POST',
      body: JSON.stringify({
        name,
        columns: columns.map((c) => ({
          name: c.name,
          type: c.type,
          primaryKey: c.primaryKey,
          nullable: c.nullable,
          autoGenerate: c.autoGenerate,
        })),
      }),
    }),

  renameTable: (projectId: string, table: string, name: string, schema?: string) =>
    request<void>(withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}`, schema), {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  addColumn: (projectId: string, table: string, draft: AddColumnDraft, schema?: string) =>
    request<void>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/columns`, schema),
      { method: 'POST', body: JSON.stringify(draft) },
    ),

  alterColumn: (projectId: string, table: string, column: string, patch: AlterColumnPatch, schema?: string) =>
    request<void>(
      withSchema(
        `/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/columns/${encodeURIComponent(column)}`,
        schema,
      ),
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  dropColumn: (projectId: string, table: string, column: string, schema?: string) =>
    request<void>(
      withSchema(
        `/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/columns/${encodeURIComponent(column)}`,
        schema,
      ),
      { method: 'DELETE' },
    ),

  dropTable: (projectId: string, table: string, schema?: string) =>
    request<void>(withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}`, schema), {
      method: 'DELETE',
    }),

  getSchema: (projectId: string, table: string, schema?: string) =>
    request<ColumnInfo[]>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/schema`, schema),
    ),

  getRows: (
    projectId: string,
    table: string,
    limit: number,
    offset: number,
    filters?: RowFilter[],
    schema?: string,
    sort?: RowSort | null,
  ) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filters && filters.length > 0) {
      params.set('filters', JSON.stringify(filters));
    }
    if (schema) params.set('schema', schema);
    if (sort) {
      params.set('sort', sort.column);
      params.set('dir', sort.direction);
    }
    return request<RowsResponse>(
      `/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/rows?${params.toString()}`,
    );
  },

  insertRow: (projectId: string, table: string, values: Record<string, unknown>, schema?: string) =>
    request<Record<string, unknown>>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/rows`, schema),
      { method: 'POST', body: JSON.stringify(values) },
    ),

  updateRow: (
    projectId: string,
    table: string,
    pk: Record<string, unknown>,
    values: Record<string, unknown>,
    schema?: string,
  ) =>
    request<Record<string, unknown>>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/rows`, schema),
      { method: 'PUT', body: JSON.stringify({ pk, values }) },
    ),

  deleteRow: (projectId: string, table: string, pk: Record<string, unknown>, schema?: string) =>
    request<void>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/rows`, schema),
      { method: 'DELETE', body: JSON.stringify({ pk }) },
    ),

  runSql: (projectId: string, query: string) =>
    request<SqlResult>(`/projects/${encodeURIComponent(projectId)}/sql`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  getRlsStatus: (projectId: string, table: string, schema?: string) =>
    request<RlsStatus>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/rls`, schema),
    ),

  setRlsEnabled: (projectId: string, table: string, enabled: boolean, schema?: string) =>
    request<void>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/rls`, schema),
      { method: 'PUT', body: JSON.stringify({ enabled }) },
    ),

  listPolicies: (projectId: string, table: string, schema?: string) =>
    request<PolicyInfo[]>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/policies`, schema),
    ),

  createPolicy: (
    projectId: string,
    table: string,
    dto: { name: string; command: string; roles?: string[]; using?: string; withCheck?: string },
    schema?: string,
  ) =>
    request<void>(
      withSchema(`/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/policies`, schema),
      { method: 'POST', body: JSON.stringify(dto) },
    ),

  dropPolicy: (projectId: string, table: string, name: string, schema?: string) =>
    request<void>(
      withSchema(
        `/projects/${encodeURIComponent(projectId)}/tables/${encodeURIComponent(table)}/policies/${encodeURIComponent(name)}`,
        schema,
      ),
      { method: 'DELETE' },
    ),
};
