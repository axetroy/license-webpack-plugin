export type Preset = 'none' | 'permissive' | 'commercial' | 'enterprise' | 'oss' | 'strict';

export interface Policy {
  preset?: Preset;
  allow?: string[];
  review?: string[];
  deny?: string[];
}

export type ComplianceStatus = 'PASS' | 'REVIEW' | 'FAIL';

export interface ComplianceResult {
  status: ComplianceStatus;
  reasons: string[];
}

export interface ComplianceReport {
  overall: ComplianceStatus;
  packages: Map<string, ComplianceResult>;
  warnings: string[];
  errors: string[];
}

export type LicenseSeverity = 'ignore' | 'warn' | 'error';
