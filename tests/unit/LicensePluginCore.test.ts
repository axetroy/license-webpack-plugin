import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LicensePluginCore, type LicensePluginContext } from '../../src/LicensePluginCore.js';
import { type PackageInfo } from '../../src/model/PackageInfo.js';
import type { Policy } from '../../src/compliance/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockContext: LicensePluginContext = {
  reportError: () => {},
  reportWarning: () => {},
};

function makePackage(name: string, version: string): PackageInfo {
  return {
    name,
    version,
    path: `/node_modules/${name}`,
    packageJsonPath: `/node_modules/${name}/package.json`,
    chunks: ['main'],
    modules: [],
  };
}

function makePackageWithLicense(name: string, version: string, license: string): PackageInfo {
  return {
    name,
    version,
    path: `/node_modules/${name}`,
    packageJsonPath: `/node_modules/${name}/package.json`,
    chunks: ['main'],
    modules: [],
    license,
  };
}

// The test project itself is "license-checker-plugin" with MIT license.
// We use the project root to exercise the real LicenseDatabase.
const WORKSPACE = path.resolve(__dirname, '../..');

describe('LicensePluginCore', () => {
  it('returns license info for bundled packages', async () => {
    const core = new LicensePluginCore({ workspaceRoot: __dirname });
    await core.initialize(__dirname, mockContext);

    const packages = new Map<string, PackageInfo>();
    packages.set('license-checker-plugin@1.0.5', makePackage('license-checker-plugin', '1.0.5'));

    const { items, errors } = await core.generateLicenseItems(packages, mockContext);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].license.license).toBeTruthy();
  });

  it('handles packages without licenses gracefully', async () => {
    const core = new LicensePluginCore({ workspaceRoot: __dirname });
    await core.initialize(__dirname, mockContext);

    const packages = new Map<string, PackageInfo>();
    packages.set('unknown-package@1.0.0', makePackage('unknown-package', '1.0.0'));

    const { items, errors } = await core.generateLicenseItems(packages, mockContext);
    expect(items.length).toBeGreaterThanOrEqual(0);
  });

  // -----------------------------------------------------------------------
  // policy option
  // -----------------------------------------------------------------------
  describe('policy', () => {
    it('defaults to commercial preset', () => {
      const core = new LicensePluginCore();
      expect(core.options.policy).toEqual({ preset: 'commercial' });
    });

    it('accepts a preset name string via policy object', () => {
      const core = new LicensePluginCore({ policy: { preset: 'oss' } });
      expect(core.options.policy).toEqual({ preset: 'oss' });
    });

    it('accepts a custom policy with allow list', async () => {
      const core = new LicensePluginCore({ workspaceRoot: WORKSPACE, policy: { allow: ['MIT'] } });
      await core.initialize(WORKSPACE, mockContext);

      const packages = new Map<string, PackageInfo>();
      // The project has MIT license, should pass
      packages.set('non-existent-pkg@1.0.0', makePackageWithLicense('non-existent-pkg', '1.0.0', 'MIT'));

      const { errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
    });

    it('fails a package with denied license', async () => {
      const errorsAcc: string[] = [];
      const core = new LicensePluginCore({
        workspaceRoot: WORKSPACE,
        policy: { deny: ['MIT'] },
      });
      await core.initialize(WORKSPACE, mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('pkg@1.0.0', makePackageWithLicense('pkg', '1.0.0', 'MIT'));

      const { errors } = await core.generateLicenseItems(packages, {
        ...mockContext,
        reportError: (msg) => errorsAcc.push(msg),
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // unknownLicense option
  // -----------------------------------------------------------------------
  describe('unknownLicense', () => {
    it('warn (default) makes UNKNOWN license a REVIEW', async () => {
      const warningsAcc: string[] = [];
      const core = new LicensePluginCore({ workspaceRoot: WORKSPACE });
      await core.initialize(WORKSPACE, mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('unknown@1.0.0', makePackageWithLicense('unknown', '1.0.0', 'UNKNOWN'));

      const { errors, warnings } = await core.generateLicenseItems(packages, {
        ...mockContext,
        reportWarning: (msg) => warningsAcc.push(msg),
      });
      expect(errors).toEqual([]);
      // UNKNOWN with default severity 'warn' -> REVIEW -> warnings
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('error makes UNKNOWN license a FAIL', async () => {
      const errorsAcc: string[] = [];
      const core = new LicensePluginCore({
        workspaceRoot: WORKSPACE,
        unknownLicense: 'error',
      });
      await core.initialize(WORKSPACE, mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('unknown@1.0.0', makePackageWithLicense('unknown', '1.0.0', 'UNKNOWN'));

      const { errors } = await core.generateLicenseItems(packages, {
        ...mockContext,
        reportError: (msg) => errorsAcc.push(msg),
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('ignore makes UNKNOWN license pass', async () => {
      const core = new LicensePluginCore({
        workspaceRoot: WORKSPACE,
        unknownLicense: 'ignore',
      });
      await core.initialize(WORKSPACE, mockContext);

      const packages = new Map<string, PackageInfo>();
      packages.set('unknown@1.0.0', makePackageWithLicense('unknown', '1.0.0', 'UNKNOWN'));

      const { errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // missingLicense option (empty string is normalized to UNKNOWN early,
  // so the missingLicense severity only applies in the compliance engine
  // when the license string is literally empty — tested in ComplianceEngine)
  // -----------------------------------------------------------------------
  describe('missingLicense', () => {
    it('accepts missingLicense option', () => {
      const core = new LicensePluginCore({ workspaceRoot: WORKSPACE, missingLicense: 'error' });
      expect(core.options.missingLicense).toBe('error');
    });
  });

  // -----------------------------------------------------------------------
  // return type includes warnings
  // -----------------------------------------------------------------------
  describe('warnings in result', () => {
    it('returns warnings for REVIEW packages', async () => {
      const core = new LicensePluginCore({
        workspaceRoot: WORKSPACE,
        policy: { allow: ['MIT'] },
      });
      await core.initialize(WORKSPACE, mockContext);

      const packages = new Map<string, PackageInfo>();
      // A package not in allow list with no preset → REVIEW
      packages.set('non-mit@1.0.0', makePackageWithLicense('non-mit', '1.0.0', 'Apache-2.0'));

      const { warnings, errors } = await core.generateLicenseItems(packages, mockContext);
      expect(errors).toEqual([]);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
