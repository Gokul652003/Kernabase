export const POLICY_COMMANDS = ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
export type PolicyCommand = (typeof POLICY_COMMANDS)[number];

export interface PolicyInfo {
  name: string;
  permissive: 'PERMISSIVE' | 'RESTRICTIVE';
  roles: string[];
  command: PolicyCommand;
  using: string | null;
  withCheck: string | null;
}

export interface RlsStatus {
  enabled: boolean;
}
