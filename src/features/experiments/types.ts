// src/features/experiments/types.ts
// The shapes the testing screens work with.

export interface ExperimentRow {
  experimentId: string;
  key: string;
  name: string;
  hypothesis: string | null;
  goalEventName: string;
  surface: string;
  status: string;
  trafficPercentage: number;
  variantCount: number;
  totalAssignments: number;
  totalConversions: number;
  startedAt: string | null;
  conclusion: string | null;
}

export interface VariantRow {
  variantId: string;
  key: string;
  name: string;
  isControl: boolean;
  weight: number;
  assignmentCount: number;
  conversionCount: number;
  conversionRate: string;
}
