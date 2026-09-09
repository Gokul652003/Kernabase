import { CreateTableDto } from '@/tables/dto/create-table.dto';
import { AddColumnRequest, AlterColumnRequest } from '@/tables/alter-table.builder';
import { ColumnInfo, RowFilter, RowSort, RowsResponse, TableInfo } from '@/tables/tables.types';

export const TABLES_APPLICATION = Symbol('TABLES_APPLICATION');

/** Named rather than positional: row listing has too many optional knobs to pass in order. */
export interface ListRowsOptions {
  table: string;
  schema?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  filters?: RowFilter[] | undefined;
  cursor?: string | undefined;
  sort?: RowSort | undefined;
  /** Counting every matching row costs a second scan; skip it while paging. */
  includeTotal?: boolean | undefined;
}

export interface TablesApplication {
  listTables(schema?: string): Promise<TableInfo[]>;
  createTable(dto: CreateTableDto, schema?: string): Promise<void>;
  dropTable(table: string, schema?: string): Promise<void>;
  renameTable(table: string, newName: string, schema?: string): Promise<void>;
  addColumn(table: string, request: AddColumnRequest, schema?: string): Promise<void>;
  alterColumn(table: string, column: string, request: AlterColumnRequest, schema?: string): Promise<void>;
  dropColumn(table: string, column: string, schema?: string): Promise<void>;
  getSchema(table: string, schema?: string): Promise<ColumnInfo[]>;
  getRows(options: ListRowsOptions): Promise<RowsResponse>;
  insertRow(table: string, values: Record<string, unknown>, schema?: string): Promise<Record<string, unknown>>;
  updateRow(table: string, pk: Record<string, unknown>, values: Record<string, unknown>, schema?: string): Promise<Record<string, unknown>>;
  deleteRow(table: string, pk: Record<string, unknown>, schema?: string): Promise<void>;
}
