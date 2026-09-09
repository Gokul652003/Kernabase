export const SQL_APPLICATION = Symbol('SQL_APPLICATION');

export interface SqlResult {
  rows: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
}

export interface SqlApplication {
  run(query: string): Promise<SqlResult>;
}
