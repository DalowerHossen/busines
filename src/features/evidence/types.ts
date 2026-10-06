// src/features/evidence/types.ts
// The shapes the proof of work screens work with.

export interface WorkEvidenceItem {
  evidenceId: string;
  kind: string;
  title: string;
  description: string | null;
  fileId: string | null;
  fileName: string | null;
  byteSize: number;
  externalUrl: string | null;
  hoursWorked: string | null;
  performedOn: string | null;
  isClientVisible: boolean;
  isSealed: boolean;
  createdAt: string;
}

export interface WorkEvidenceSummary {
  itemCount: number;
  clientVisibleCount: number;
  fileCount: number;
  linkCount: number;
  hoursLogged: string;
  isSealed: boolean;
}

export interface ClientWorkEvidenceItem {
  evidenceId: string;
  kind: string;
  title: string;
  description: string | null;
  fileId: string | null;
  fileName: string | null;
  byteSize: number;
  externalUrl: string | null;
  hoursWorked: string | null;
  performedOn: string | null;
}
