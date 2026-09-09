export const DEFAULT_SCHEMA = 'public';

export function quoteIdentifier(name: string): string {
  if (typeof name !== 'string' || name.length === 0 || name.length > 63 || name.includes('\0')) {
    throw new Error('Invalid identifier');
  }
  return `"${name.replace(/"/g, '""')}"`;
}

export function normalizeSchema(schema?: string): string {
  return schema?.trim() || DEFAULT_SCHEMA;
}

export function qualifiedName(schema: string, object: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(object)}`;
}

/**
 * Quotes a value as a SQL string literal.
 *
 * Only for the handful of places PostgreSQL cannot parameterize — DDL defaults and
 * role passwords. Everywhere a placeholder is legal, use one instead.
 */
export function quoteLiteral(value: string): string {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid literal');
  return `'${value.replace(/'/g, "''")}'`;
}
