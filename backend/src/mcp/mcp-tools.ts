import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodTypeAny } from 'zod';
import { ALLOWED_COLUMN_TYPES } from '@/common/allowed-types';
import { SchemasApplication } from '@/schemas/schemas-service.port';
import { TablesApplication } from '@/tables/tables-service.port';
import { FILTER_OPS, SORT_DIRECTIONS } from '@/tables/tables.types';
import { parseRowSort } from '@/tables/row-query.builder';

// Deliberately NOT using McpServer's registerTool()/tool() convenience API here: its input
// schema type is `Record<string, z3.ZodTypeAny | z4.$ZodType>` (it supports both zod major
// versions at once). Passing a zod-v3-only raw shape through that generic makes tsc try to
// resolve every property against the whole union — combined with zod v4's very heavy internal
// types being pulled in for that check even though only v3 is installed, this reliably blew
// compile time up past 5+ minutes and several GB of memory. The low-level Server API below
// takes plain JSON Schema for the wire protocol and does its own runtime validation via a
// single `.parse()` call per tool, which never touches that generic union at all.
function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

// Every tool falls into one of three permission categories, gated by the project's MCP
// token: 'read' is always available once MCP is enabled, 'write' (row insert/update/delete)
// and 'schema' (create/drop table/schema) are opt-in toggles set on the project.
type ToolCategory = 'read' | 'write' | 'schema';

interface McpToolContext {
  tables: TablesApplication;
  schemas: SchemasApplication;
}

interface ToolDef<Args = never> {
  name: string;
  description: string;
  category: ToolCategory;
  destructive?: boolean;
  /** JSON Schema sent to the client; `argsSchema` is what actually validates a call. */
  inputSchema: Record<string, unknown>;
  argsSchema: z.ZodType<Args>;
  run: (ctx: McpToolContext, args: Args) => Promise<unknown>;
}

/**
 * Type-checks one tool against its own schema, then erases the argument type so tools
 * with different shapes can live in one array. `never` as the erased type makes the
 * single `as never` in `CallToolRequestSchema` the only unchecked step in the file.
 */
function defineTool<Schema extends ZodTypeAny>(
  def: Omit<ToolDef<z.infer<Schema>>, 'argsSchema'> & { argsSchema: Schema },
): ToolDef {
  return def as unknown as ToolDef;
}

const filterSchema = z.object({ column: z.string(), op: z.enum(FILTER_OPS), value: z.string().optional() });

const columnDefSchema = z.object({
  name: z.string(),
  type: z.enum(ALLOWED_COLUMN_TYPES),
  primaryKey: z.boolean().optional(),
  nullable: z.boolean().optional(),
  autoGenerate: z.boolean().optional(),
});

const TOOLS: ToolDef[] = [
  defineTool({
    name: 'list_schemas',
    description: 'List Postgres schemas in this database (excludes system schemas).',
    category: 'read',
    inputSchema: { type: 'object', properties: {} },
    argsSchema: z.object({}),
    run: ({ schemas }) => schemas.list(),
  }),
  defineTool({
    name: 'list_tables',
    description: 'List tables in a schema (defaults to "public").',
    category: 'read',
    inputSchema: { type: 'object', properties: { schema: { type: 'string' } } },
    argsSchema: z.object({ schema: z.string().optional() }),
    run: ({ tables }, args) => tables.listTables(args.schema),
  }),
  defineTool({
    name: 'describe_table',
    description: 'Get column definitions (name, type, nullability, default, identity, primary key) for a table.',
    category: 'read',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, schema: { type: 'string' } },
      required: ['table'],
    },
    argsSchema: z.object({ table: z.string(), schema: z.string().optional() }),
    run: ({ tables }, args) => tables.getSchema(args.table, args.schema),
  }),
  defineTool({
    name: 'create_table',
    description: 'Create a new table with the given columns.',
    category: 'schema',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        schema: { type: 'string' },
        columns: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ALLOWED_COLUMN_TYPES as unknown as string[] },
              primaryKey: { type: 'boolean' },
              nullable: { type: 'boolean' },
              autoGenerate: { type: 'boolean', description: 'Auto-increment (integer types) or gen_random_uuid() (uuid).' },
            },
            required: ['name', 'type'],
          },
        },
      },
      required: ['name', 'columns'],
    },
    argsSchema: z.object({ name: z.string(), schema: z.string().optional(), columns: z.array(columnDefSchema).min(1) }),
    run: async ({ tables }, args) => {
      await tables.createTable({ name: args.name, columns: args.columns }, args.schema);
      return { created: true, table: args.name };
    },
  }),
  defineTool({
    name: 'drop_table',
    description: 'Drop (delete) a table and all its data. This cannot be undone.',
    category: 'schema',
    destructive: true,
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, schema: { type: 'string' } },
      required: ['table'],
    },
    argsSchema: z.object({ table: z.string(), schema: z.string().optional() }),
    run: async ({ tables }, args) => {
      await tables.dropTable(args.table, args.schema);
      return { dropped: true, table: args.table };
    },
  }),
  defineTool({
    name: 'add_column',
    description: 'Add a new column to an existing table.',
    category: 'schema',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        schema: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ALLOWED_COLUMN_TYPES as unknown as string[] },
        nullable: { type: 'boolean', description: 'Defaults to true. A NOT NULL column needs a default on a non-empty table.' },
        autoGenerate: { type: 'boolean', description: 'Identity (integer types) or gen_random_uuid() (uuid).' },
        defaultValue: {
          type: 'string',
          description: 'A literal value, or one of: now(), current_timestamp, current_date, gen_random_uuid(), true, false, null.',
        },
      },
      required: ['table', 'name', 'type'],
    },
    argsSchema: z.object({
      table: z.string(),
      schema: z.string().optional(),
      name: z.string(),
      type: z.enum(ALLOWED_COLUMN_TYPES),
      nullable: z.boolean().optional(),
      autoGenerate: z.boolean().optional(),
      defaultValue: z.string().optional(),
    }),
    run: async ({ tables }, args) => {
      await tables.addColumn(
        args.table,
        {
          name: args.name,
          type: args.type,
          nullable: args.nullable,
          autoGenerate: args.autoGenerate,
          defaultValue: args.defaultValue,
        },
        args.schema,
      );
      return { added: true, table: args.table, column: args.name };
    },
  }),
  defineTool({
    name: 'alter_column',
    description:
      'Change an existing column: rename it, change its type, toggle nullability, or set/drop its default. Only the fields you pass are changed.',
    category: 'schema',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        schema: { type: 'string' },
        column: { type: 'string', description: 'The column to change (its current name).' },
        name: { type: 'string', description: 'Rename the column to this.' },
        type: { type: 'string', enum: ALLOWED_COLUMN_TYPES as unknown as string[] },
        nullable: { type: 'boolean' },
        defaultValue: { type: 'string' },
        dropDefault: { type: 'boolean', description: 'Remove the existing default.' },
      },
      required: ['table', 'column'],
    },
    argsSchema: z.object({
      table: z.string(),
      schema: z.string().optional(),
      column: z.string(),
      name: z.string().optional(),
      type: z.enum(ALLOWED_COLUMN_TYPES).optional(),
      nullable: z.boolean().optional(),
      defaultValue: z.string().optional(),
      dropDefault: z.boolean().optional(),
    }),
    run: async ({ tables }, args) => {
      await tables.alterColumn(
        args.table,
        args.column,
        {
          name: args.name,
          type: args.type,
          nullable: args.nullable,
          defaultValue: args.defaultValue,
          dropDefault: args.dropDefault,
        },
        args.schema,
      );
      return { altered: true, table: args.table, column: args.name ?? args.column };
    },
  }),
  defineTool({
    name: 'drop_column',
    description: 'Drop a column and all its data. This cannot be undone.',
    category: 'schema',
    destructive: true,
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, schema: { type: 'string' }, column: { type: 'string' } },
      required: ['table', 'column'],
    },
    argsSchema: z.object({ table: z.string(), schema: z.string().optional(), column: z.string() }),
    run: async ({ tables }, args) => {
      await tables.dropColumn(args.table, args.column, args.schema);
      return { dropped: true, table: args.table, column: args.column };
    },
  }),
  defineTool({
    name: 'rename_table',
    description: 'Rename a table within its schema.',
    category: 'schema',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, schema: { type: 'string' }, name: { type: 'string' } },
      required: ['table', 'name'],
    },
    argsSchema: z.object({ table: z.string(), schema: z.string().optional(), name: z.string() }),
    run: async ({ tables }, args) => {
      await tables.renameTable(args.table, args.name, args.schema);
      return { renamed: true, from: args.table, to: args.name };
    },
  }),
  defineTool({
    name: 'create_schema',
    description: 'Create a new Postgres schema.',
    category: 'schema',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    argsSchema: z.object({ name: z.string() }),
    run: async ({ schemas }, args) => {
      await schemas.create(args.name);
      return { created: true, schema: args.name };
    },
  }),
  defineTool({
    name: 'drop_schema',
    description: 'Drop a Postgres schema. Fails if it still contains tables or other objects.',
    category: 'schema',
    destructive: true,
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    argsSchema: z.object({ name: z.string() }),
    run: async ({ schemas }, args) => {
      await schemas.drop(args.name);
      return { dropped: true, schema: args.name };
    },
  }),
  defineTool({
    name: 'query_rows',
    description: 'Read rows from a table, with optional column filters, sorting, limit and offset.',
    category: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        schema: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 1000 },
        offset: { type: 'integer', minimum: 0 },
        sort: { type: 'string', description: 'Column to order by. Defaults to the primary key.' },
        dir: { type: 'string', enum: [...SORT_DIRECTIONS], description: 'Sort direction (default "asc").' },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              op: { type: 'string', enum: FILTER_OPS as unknown as string[] },
              value: { type: 'string' },
            },
            required: ['column', 'op'],
          },
        },
      },
      required: ['table'],
    },
    argsSchema: z.object({
      table: z.string(),
      schema: z.string().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      offset: z.number().int().min(0).optional(),
      filters: z.array(filterSchema).optional(),
      sort: z.string().optional(),
      dir: z.enum(SORT_DIRECTIONS).optional(),
    }),
    run: ({ tables }, args) => tables.getRows({
      table: args.table,
      schema: args.schema,
      limit: args.limit,
      offset: args.offset,
      filters: args.filters,
      sort: parseRowSort(args.sort, args.dir),
    }),
  }),
  defineTool({
    name: 'insert_row',
    description: 'Insert a new row into a table. Returns the inserted row.',
    category: 'write',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, schema: { type: 'string' }, values: { type: 'object' } },
      required: ['table', 'values'],
    },
    argsSchema: z.object({ table: z.string(), schema: z.string().optional(), values: z.record(z.unknown()) }),
    run: ({ tables }, args) => tables.insertRow(args.table, args.values, args.schema),
  }),
  defineTool({
    name: 'update_row',
    description: 'Update a row identified by primary key column(s). Returns the updated row.',
    category: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        schema: { type: 'string' },
        pk: { type: 'object' },
        values: { type: 'object' },
      },
      required: ['table', 'pk', 'values'],
    },
    argsSchema: z.object({
      table: z.string(),
      schema: z.string().optional(),
      pk: z.record(z.unknown()),
      values: z.record(z.unknown()),
    }),
    run: ({ tables }, args) => tables.updateRow(args.table, args.pk, args.values, args.schema),
  }),
  defineTool({
    name: 'delete_row',
    description: 'Delete a row identified by primary key column(s).',
    category: 'write',
    destructive: true,
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, schema: { type: 'string' }, pk: { type: 'object' } },
      required: ['table', 'pk'],
    },
    argsSchema: z.object({ table: z.string(), schema: z.string().optional(), pk: z.record(z.unknown()) }),
    run: async ({ tables }, args) => {
      await tables.deleteRow(args.table, args.pk, args.schema);
      return { deleted: true };
    },
  }),
];

export interface McpToolPermissions {
  allowWrite: boolean;
  allowSchema: boolean;
}

function isAllowed(category: ToolCategory, permissions: McpToolPermissions): boolean {
  if (category === 'read') return true;
  if (category === 'write') return permissions.allowWrite;
  return permissions.allowSchema;
}

// Raw SQL and per-object grants (GRANT/REVOKE) stay out of scope regardless of
// permissions — everything else is available once its category is enabled on the project.
export function buildMcpServer(
  tables: TablesApplication,
  schemas: SchemasApplication,
  projectName: string,
  permissions: McpToolPermissions,
): Server {
  const server = new Server(
    { name: `kernabase:${projectName}`, version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.filter((t) => isAllowed(t.category, permissions)).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { readOnlyHint: t.category === 'read', destructiveHint: !!t.destructive },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOLS.find((t) => t.name === request.params.name);
    if (!tool) return errorResult(`Unknown tool: ${request.params.name}`);
    if (!isAllowed(tool.category, permissions)) {
      return errorResult(`Tool "${tool.name}" is not enabled for this MCP token (requires "${tool.category}" access).`);
    }
    try {
      const args = tool.argsSchema.parse(request.params.arguments ?? {});
      return textResult(await tool.run({ tables, schemas }, args as never));
    } catch (err) {
      return errorResult(err);
    }
  });

  return server;
}
