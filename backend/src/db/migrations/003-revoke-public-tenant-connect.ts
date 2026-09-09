/**
 * PostgreSQL grants CONNECT to PUBLIC on every new database, so managed tenant
 * databases created before that was revoked at provisioning are still open to any
 * other tenant role. They cannot read tables they have no grant on, but they can
 * connect and enumerate the system catalogs — table and column names of another user.
 *
 * Each REVOKE is attempted independently: a database this role does not own should be
 * reported and skipped, never fail startup for every other tenant.
 */
export const revokePublicTenantConnectMigration = `
  DO $$
  DECLARE
    target record;
  BEGIN
    FOR target IN
      SELECT DISTINCT p.database
      FROM _studio.projects p
      JOIN pg_database d ON d.datname = p.database
      WHERE p.is_managed
    LOOP
      BEGIN
        EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', target.database);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not revoke PUBLIC CONNECT on %: %', target.database, SQLERRM;
      END;
    END LOOP;
  END $$;
`;
