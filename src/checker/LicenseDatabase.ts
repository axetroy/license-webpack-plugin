import { execFile } from 'child_process';
import type { ModuleInfos, InitOpts } from 'license-checker-rseidelsohn';
import { LicenseInfo } from '../model/LicenseInfo';
import { LicenseCache } from './LicenseCache';

// Dynamic import types for license-checker-rseidelsohn (ESM module)
type LicenseCheckerModule = {
  init(opts: InitOpts, callback: (err: Error | null, packages: ModuleInfos) => void): void;
};

export class LicenseDatabase {
  private readonly cache = new LicenseCache();
  private initialized = false;
  private initializedPath: string | null = null;

  async initialize(startPath: string): Promise<void> {
    if (this.initialized && this.initializedPath === startPath) {
      return;
    }

    // Clear cached data when switching to a different workspace path.
    this.cache.clear();
    this.initialized = false;

    const packages = await this.loadPackages(startPath);

    for (const [key, info] of Object.entries(packages ?? {})) {
      // licenses can be string or string[]
      let licenseStr = 'UNKNOWN';
      if (info.licenses) {
        if (Array.isArray(info.licenses)) {
          licenseStr = info.licenses.join(' AND ');
        } else {
          licenseStr = info.licenses;
        }
      }

      // licenseText can be non-string in edge cases; only store valid strings
      const licenseText =
        typeof info.licenseText === 'string' && info.licenseText.length > 0 ? info.licenseText : undefined;

      const licenseInfo: LicenseInfo = {
        license: licenseStr,
        licenseFile: info.licenseFile,
        licenseText,
        repository: info.repository,
        homepage: info.url,
        author: info.publisher
          ? info.email
            ? `${info.publisher} <${info.email}>`
            : info.publisher
          : undefined,
        publisher: info.publisher,
        private: info.private,
      };

      this.cache.set(key, licenseInfo);
    }

    this.initialized = true;
    this.initializedPath = startPath;
  }

  getLicense(packageName: string, packageVersion: string): LicenseInfo {
    return this.cache.get(`${packageName}@${packageVersion}`) || { license: 'UNKNOWN' };
  }

  getCache(): LicenseCache {
    return this.cache;
  }

  private async loadPackages(startPath: string): Promise<ModuleInfos> {
    try {
      return await this.runLicenseCheckerDirect(startPath);
    } catch {
      return this.runLicenseCheckerInSubprocess(startPath);
    }
  }

  private runLicenseCheckerDirect(startPath: string): Promise<ModuleInfos> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const licenseChecker = require('license-checker-rseidelsohn') as LicenseCheckerModule;

    const options: InitOpts = {
      start: startPath,
      excludePrivatePackages: false,
      production: false,
      customFormat: {
        licenseText: true,
      },
    };

    return new Promise((resolve, reject) => {
      licenseChecker.init(options, (err, packages) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(packages ?? {});
      });
    });
  }

  private runLicenseCheckerInSubprocess(startPath: string): Promise<ModuleInfos> {
    const script = [
      "import { init } from 'license-checker-rseidelsohn';",
      'const options = JSON.parse(process.argv[1]);',
      'init(options, (err, packages) => {',
      '  if (err) {',
      '    console.error(err instanceof Error ? err.message : String(err));',
      '    process.exit(1);',
      '    return;',
      '  }',
      '  process.stdout.write(JSON.stringify(packages || {}));',
      '});',
    ].join('\n');

    const options = JSON.stringify({
      start: startPath,
      excludePrivatePackages: false,
      production: false,
      customFormat: {
        licenseText: true,
      },
    });

    return new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        ['--input-type=module', '-e', script, options],
        { maxBuffer: 20 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }

          try {
            resolve(JSON.parse(stdout) as ModuleInfos);
          } catch (parseError) {
            reject(parseError);
          }
        }
      );
    });
  }
}
