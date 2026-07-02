import { LicenseDatabase } from './checker/LicenseDatabase';
import { Formatter } from './formatter/Formatter';
import { HtmlFormatter } from './formatter/HtmlFormatter';
import { JsonFormatter } from './formatter/JsonFormatter';
import { MarkdownFormatter } from './formatter/MarkdownFormatter';
import { TxtFormatter } from './formatter/TxtFormatter';
import { LicenseInfo, OutputItem } from './model/LicenseInfo';
import { LicenseBuildReport } from './model/LicenseBuildReport';
import { PackageInfo } from './model/PackageInfo';
import { Recorder } from './Recorder';

export type OutputFormat = 'txt' | 'json' | 'markdown' | 'html';

export interface LicensePluginOptions {
  filename?: string;
  format?: OutputFormat;
  includeLicenseText?: boolean;
  includeRepository?: boolean;
  includeHomepage?: boolean;
  includeAuthor?: boolean;
  includePackages?: string[];
  excludePackages?: string[];
  includeLicenses?: string[];
  excludeLicenses?: string[];
  onlyAllow?: string[];
  failOn?: string[];
  sort?: boolean;
  deduplicateLicense?: boolean;
  cache?: boolean;
  workspaceRoot?: string;
  dangerouslyAllowFailingBuild?: boolean;
  recorder?: Recorder;
  recordOnly?: boolean;
  waitForRecorderCount?: number;
}

export interface LicensePluginContext {
  reportError(msg: string): void;
  reportWarning(msg: string): void;
}

export class LicensePluginCore {
  readonly options: Required<
    Omit<LicensePluginOptions, 'recorder' | 'waitForRecorderCount' | 'dangerouslyAllowFailingBuild'>
  > & {
    recorder: Recorder | undefined;
    waitForRecorderCount: number | undefined;
    dangerouslyAllowFailingBuild: boolean;
  };
  private db: LicenseDatabase;

  constructor(options: LicensePluginOptions = {}) {
    this.options = {
      filename: options.filename || 'licenses.txt',
      format: options.format || 'txt',
      includeLicenseText: options.includeLicenseText !== false,
      includeRepository: options.includeRepository !== false,
      includeHomepage: options.includeHomepage !== false,
      includeAuthor: options.includeAuthor !== false,
      includePackages: options.includePackages || [],
      excludePackages: options.excludePackages || [],
      includeLicenses: options.includeLicenses || [],
      excludeLicenses: options.excludeLicenses || [],
      onlyAllow: options.onlyAllow || [],
      failOn: options.failOn || [],
      sort: options.sort !== false,
      deduplicateLicense: options.deduplicateLicense !== false,
      cache: options.cache !== false,
      workspaceRoot: options.workspaceRoot || '',
      dangerouslyAllowFailingBuild: options.dangerouslyAllowFailingBuild === true,
      recorder: options.recorder,
      recordOnly: options.recordOnly === true,
      waitForRecorderCount: options.waitForRecorderCount,
    };
    this.db = new LicenseDatabase();
  }

  async initialize(startPath: string, context: LicensePluginContext): Promise<boolean> {
    if (!this.options.cache) {
      this.db = new LicenseDatabase();
    }

    try {
      await this.db.initialize(startPath);
      return true;
    } catch (error) {
      const message = `LicensePlugin: Failed to initialize license database: ${String(error)}`;
      if (this.options.dangerouslyAllowFailingBuild) {
        context.reportWarning(message);
      } else {
        context.reportError(message);
      }
      return false;
    }
  }

  async generateLicenseItems(
    packages: Map<string, PackageInfo>,
    context: LicensePluginContext
  ): Promise<{ items: OutputItem[]; errors: string[] }> {
    let items: OutputItem[] = [];
    const seenLicenseTexts = new Set<string>();
    const licenseErrors: string[] = [];

    for (const pkgInfo of packages.values()) {
      if (this.options.includePackages.length > 0 && !this.options.includePackages.includes(pkgInfo.name)) {
        continue;
      }
      if (this.options.excludePackages.includes(pkgInfo.name)) {
        continue;
      }

      const licenseInfo = this.filterLicenseFields(this.db.getLicense(pkgInfo.name, pkgInfo.version));

      if (this.options.includeLicenses.length > 0 && !this.options.includeLicenses.includes(licenseInfo.license)) {
        continue;
      }
      if (this.options.excludeLicenses.includes(licenseInfo.license)) {
        continue;
      }

      if (this.options.onlyAllow.length > 0 && !this.options.onlyAllow.includes(licenseInfo.license)) {
        licenseErrors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is not in the allowed list: ${this.options.onlyAllow.join(', ')}`
        );
        continue;
      }

      if (this.options.failOn.length > 0 && this.options.failOn.includes(licenseInfo.license)) {
        licenseErrors.push(
          `LicensePlugin: License "${licenseInfo.license}" for package "${pkgInfo.name}@${pkgInfo.version}" is in the fail list`
        );
        continue;
      }

      const normalizedLicense = { ...licenseInfo };
      if (this.options.deduplicateLicense && normalizedLicense.licenseText) {
        const text = normalizedLicense.licenseText;
        if (seenLicenseTexts.has(text)) {
          normalizedLicense.licenseText = undefined;
        } else {
          seenLicenseTexts.add(text);
        }
      }

      items.push({ package: pkgInfo, license: normalizedLicense });
    }

    if (this.options.recorder) {
      const report: LicenseBuildReport = { items };
      this.options.recorder.record(report);
    }

    if (licenseErrors.length > 0) {
      for (const errMsg of licenseErrors) {
        context.reportError(errMsg);
      }
      return { items: [], errors: licenseErrors };
    }

    if (this.options.recordOnly) {
      return { items: [], errors: [] };
    }

    if (this.options.recorder && this.options.waitForRecorderCount !== undefined) {
      let allReports: LicenseBuildReport[];
      try {
        allReports = await this.options.recorder.waitForReports(this.options.waitForRecorderCount);
      } catch (error) {
        context.reportError(String(error));
        return { items: [], errors: [String(error)] };
      }

      const seen = new Set<string>();
      const mergedItems: OutputItem[] = [];
      for (const report of allReports) {
        for (const item of report.items) {
          const key = `${item.package.name}@${item.package.version}`;
          if (!seen.has(key)) {
            seen.add(key);
            mergedItems.push(item);
          }
        }
      }
      items = mergedItems;
    }

    if (this.options.sort) {
      items = items.sort((a, b) => a.package.name.localeCompare(b.package.name));
    }

    return { items, errors: [] };
  }

  format(items: OutputItem[]): string {
    return this.createFormatter().generate(items);
  }

  private filterLicenseFields(licenseInfo: LicenseInfo): LicenseInfo {
    return {
      ...licenseInfo,
      repository: this.options.includeRepository ? licenseInfo.repository : undefined,
      homepage: this.options.includeHomepage ? licenseInfo.homepage : undefined,
      author: this.options.includeAuthor ? licenseInfo.author : undefined,
      licenseText: this.options.includeLicenseText ? licenseInfo.licenseText : undefined,
    };
  }

  private createFormatter(): Formatter {
    switch (this.options.format) {
      case 'json':
        return new JsonFormatter();
      case 'markdown':
        return new MarkdownFormatter();
      case 'html':
        return new HtmlFormatter();
      case 'txt':
      default:
        return new TxtFormatter({ includeLicenseText: this.options.includeLicenseText });
    }
  }
}
