import { PackageInfo } from './PackageInfo';

export interface LicenseInfo {
  license: string;
  licenseFile?: string;
  licenseText?: string;
  repository?: string;
  homepage?: string;
  author?: string;
  publisher?: string;
  private?: boolean;
}

export interface OutputItem {
  package: PackageInfo;
  license: LicenseInfo;
}
