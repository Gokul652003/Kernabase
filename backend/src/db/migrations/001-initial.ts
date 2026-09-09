export const initialMigration = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE SCHEMA IF NOT EXISTS _studio;
  CREATE TABLE IF NOT EXISTS _studio.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS _studio.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES _studio.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    host text NOT NULL,
    port integer NOT NULL,
    database text NOT NULL,
    db_user text NOT NULL,
    db_password text NOT NULL,
    is_managed boolean NOT NULL DEFAULT false,
    mcp_token_hash text,
    mcp_allow_write boolean NOT NULL DEFAULT false,
    mcp_allow_schema boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE _studio.projects ADD COLUMN IF NOT EXISTS is_managed boolean NOT NULL DEFAULT false;
  ALTER TABLE _studio.projects ADD COLUMN IF NOT EXISTS mcp_token_hash text;
  ALTER TABLE _studio.projects ADD COLUMN IF NOT EXISTS mcp_allow_write boolean NOT NULL DEFAULT false;
  ALTER TABLE _studio.projects ADD COLUMN IF NOT EXISTS mcp_allow_schema boolean NOT NULL DEFAULT false;
`;
