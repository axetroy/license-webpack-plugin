export interface PackageInfo {
  name: string;
  version: string;
  path: string;
  packageJsonPath: string;
  chunks: string[];
  modules: string[];
  repository?: string;
  homepage?: string;
  author?: string;
  publisher?: string;
  private?: boolean;
}
