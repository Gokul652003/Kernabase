export const controlPlaneIndexesMigration = `
  CREATE INDEX IF NOT EXISTS projects_owner_created_idx
    ON _studio.projects (owner_id, created_at DESC);
`;
