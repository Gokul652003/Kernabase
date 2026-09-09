import { CreatePolicyDto } from '@/policies/dto/create-policy.dto';
import { PolicyInfo, RlsStatus } from '@/policies/policies.types';

export const POLICIES_APPLICATION = Symbol('POLICIES_APPLICATION');

export interface PoliciesApplication {
  getRlsStatus(table: string, schema?: string): Promise<RlsStatus>;
  setRlsEnabled(table: string, enabled: boolean, schema?: string): Promise<void>;
  listPolicies(table: string, schema?: string): Promise<PolicyInfo[]>;
  createPolicy(table: string, dto: CreatePolicyDto, schema?: string): Promise<void>;
  dropPolicy(table: string, name: string, schema?: string): Promise<void>;
}
