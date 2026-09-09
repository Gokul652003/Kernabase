export const SCHEMAS_APPLICATION = Symbol('SCHEMAS_APPLICATION');

export interface SchemasApplication {
  list(): Promise<string[]>;
  create(name: string): Promise<void>;
  drop(name: string): Promise<void>;
}
