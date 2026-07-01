import { OutputItem } from './LicenseInfo';

export interface LicenseBuildReport {
  items: OutputItem[];
  generatedAt: number;
  compilerName?: string;
}
