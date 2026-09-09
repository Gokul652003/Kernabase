import { Provider } from '@nestjs/common';
import { Pool } from 'pg';
import { ConnectionRegistry } from '@/db/tenant/connection-registry.service';

/**
 * The control-plane (studio metadata) pool, as a value rather than a service.
 *
 * `ConnectionRegistry` owns its lifecycle because it owns every pool's lifecycle, but
 * control-plane repositories have no business knowing about tenant pool routing — they
 * only need somewhere to run their SQL.
 */
export const CONTROL_PLANE_POOL = Symbol('CONTROL_PLANE_POOL');

export const controlPlanePoolProvider: Provider = {
  provide: CONTROL_PLANE_POOL,
  inject: [ConnectionRegistry],
  useFactory: (registry: ConnectionRegistry): Pool => registry.getControlPlanePool(),
};
