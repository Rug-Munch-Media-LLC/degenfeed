'use client';

export type PlanId = 'free' | 'standard' | 'complete';

export interface PlanInfo {
  id: PlanId;
  label: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}

export interface AccountResult {
  ok: boolean;
  identifier?: string;
  handle?: string;
  username?: string;
  error?: string;
  redirectUrl?: string;
}

export interface ChargeBreakdown {
  total: string;
  totalCents: number;
  breakdown: { item: string; cost: string; covered: boolean }[];
  serviceFeeCents: number;
  ourProfit: number;
  requiresConfirmation: boolean;
  overageReason?: string;
  overage?: number;
}

export interface RecoveryAccount {
  protocol: string;
  identifier?: string;
  recoveryMethod: string;
}

export interface RecoveryPackage {
  message: string;
  accounts: RecoveryAccount[];
  exportDate: string;
  dataExportUrl: string;
}

export interface ProfitGuarantee {
  ourProfit?: number;
  note: string;
}

export interface RegistrationResponse {
  success: boolean;
  plan: string;
  wasPremium: boolean;
  accounts: Record<string, AccountResult>;
  charges: ChargeBreakdown;
  recoveryInfo: RecoveryPackage;
  nextSteps: string[];
  profitGuarantee?: ProfitGuarantee;
  requiresConfirmation?: boolean;
  proposedTotal?: string;
  ourProfit?: string;
  overage?: number;
  message?: string;
  action?: string;
}

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
}

export interface RegisterFlowProps {
  onComplete?: () => void;
  compact?: boolean;
}
