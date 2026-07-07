import { describe, it, expect } from '@jest/globals';
import {
  evaluateLicense,
  evaluateUnknownLicense,
  evaluateMissingLicense,
  buildComplianceReport,
} from '../../src/compliance/ComplianceEngine.js';
import type { Policy, LicenseSeverity } from '../../src/compliance/types.js';

// ---------------------------------------------------------------------------
// evaluateLicense
// ---------------------------------------------------------------------------
describe('evaluateLicense', () => {
  // --- commercial preset (default) ---
  const commercial: Policy = { preset: 'commercial' };

  it('commercial: passes MIT', () => {
    const r = evaluateLicense('MIT', commercial);
    expect(r.status).toBe('PASS');
  });

  it('commercial: passes Apache-2.0', () => {
    const r = evaluateLicense('Apache-2.0', commercial);
    expect(r.status).toBe('PASS');
  });

  it('commercial: passes LGPL-2.1 (weak copyleft)', () => {
    const r = evaluateLicense('LGPL-2.1', commercial);
    expect(r.status).toBe('PASS');
  });

  it('commercial: passes BSL-1.0 (permissive)', () => {
    expect(evaluateLicense('BSL-1.0', commercial).status).toBe('PASS');
  });

  it('commercial: passes EPL-2.0 (weak copyleft)', () => {
    expect(evaluateLicense('EPL-2.0', commercial).status).toBe('PASS');
  });

  it('commercial: passes CDDL-1.0 (weak copyleft)', () => {
    expect(evaluateLicense('CDDL-1.0', commercial).status).toBe('PASS');
  });

  it('commercial: passes EUPL-1.2 (weak copyleft)', () => {
    expect(evaluateLicense('EUPL-1.2', commercial).status).toBe('PASS');
  });

  it('commercial: passes BlueOak-1.0.0 (permissive)', () => {
    expect(evaluateLicense('BlueOak-1.0.0', commercial).status).toBe('PASS');
  });

  it('commercial: fails GPL-3.0 (strong copyleft)', () => {
    const r = evaluateLicense('GPL-3.0', commercial);
    expect(r.status).toBe('FAIL');
    expect(r.reasons[0]).toContain('denied');
  });

  it('commercial: fails AGPL-1.0 (strong copyleft)', () => {
    expect(evaluateLicense('AGPL-1.0', commercial).status).toBe('FAIL');
  });

  it('commercial: fails OSL-3.0 (strong copyleft)', () => {
    expect(evaluateLicense('OSL-3.0', commercial).status).toBe('FAIL');
  });

  it('commercial: reviews unknown license like AFL-3.0', () => {
    const r = evaluateLicense('AFL-3.0', commercial);
    expect(r.status).toBe('REVIEW');
  });

  // --- permissive preset ---
  const permissive: Policy = { preset: 'permissive' };

  it('permissive: passes MIT', () => {
    expect(evaluateLicense('MIT', permissive).status).toBe('PASS');
  });

  it('permissive: reviews LGPL-2.1 (not in permissive list)', () => {
    const r = evaluateLicense('LGPL-2.1', permissive);
    expect(r.status).toBe('REVIEW');
  });

  // --- enterprise preset ---
  const enterprise: Policy = { preset: 'enterprise' };

  it('enterprise: passes MIT', () => {
    expect(evaluateLicense('MIT', enterprise).status).toBe('PASS');
  });

  it('enterprise: fails LGPL-2.1', () => {
    expect(evaluateLicense('LGPL-2.1', enterprise).status).toBe('FAIL');
  });

  it('enterprise: fails GPL-3.0', () => {
    expect(evaluateLicense('GPL-3.0', enterprise).status).toBe('FAIL');
  });

  // --- oss preset ---
  const oss: Policy = { preset: 'oss' };

  it('oss: passes anything', () => {
    expect(evaluateLicense('MIT', oss).status).toBe('PASS');
    expect(evaluateLicense('GPL-3.0', oss).status).toBe('PASS');
    expect(evaluateLicense('Custom-License', oss).status).toBe('PASS');
  });

  // --- strict preset ---
  const strict: Policy = { preset: 'strict', allow: ['MIT'] };

  it('strict: passes MIT', () => {
    expect(evaluateLicense('MIT', strict).status).toBe('PASS');
  });

  it('strict: fails Apache-2.0 (not in allow)', () => {
    const r = evaluateLicense('Apache-2.0', strict);
    expect(r.status).toBe('FAIL');
    expect(r.reasons[0]).toContain('not in the allow list');
  });

  it('strict: fails GPL-3.0 (not in allow)', () => {
    expect(evaluateLicense('GPL-3.0', strict).status).toBe('FAIL');
  });

  // --- none preset ---
  const none: Policy = { preset: 'none' };

  it('none: always passes', () => {
    expect(evaluateLicense('GPL-3.0', none).status).toBe('PASS');
    expect(evaluateLicense('UNKNOWN', none).status).toBe('PASS');
  });

  // --- custom policy (no preset) ---
  const custom: Policy = { allow: ['MIT'], review: ['MPL-2.0'], deny: ['GPL-3.0'] };

  it('custom: passes allowed license', () => {
    expect(evaluateLicense('MIT', custom).status).toBe('PASS');
  });

  it('custom: fails denied license', () => {
    expect(evaluateLicense('GPL-3.0', custom).status).toBe('FAIL');
  });

  it('custom: reviews license in review list', () => {
    const r = evaluateLicense('MPL-2.0', custom);
    expect(r.status).toBe('REVIEW');
    expect(r.reasons[0]).toContain('requires review');
  });

  it('custom: reviews license not in any list', () => {
    const r = evaluateLicense('Apache-2.0', custom);
    expect(r.status).toBe('REVIEW');
    expect(r.reasons[0]).toContain('not explicitly allowed');
  });

  // --- preset + custom override ---
  it('custom allow overrides preset allow list', () => {
    const p: Policy = { preset: 'commercial', allow: ['MIT'] };
    // commercial normally allows Apache-2.0, but custom allow:['MIT'] overrides
    expect(evaluateLicense('Apache-2.0', p).status).not.toBe('PASS');
  });

  it('custom deny overrides preset deny list', () => {
    const p: Policy = { preset: 'commercial', deny: [] };
    // commercial normally denies GPL-3.0, but deny:[] overrides
    expect(evaluateLicense('GPL-3.0', p).status).not.toBe('FAIL');
  });
});

// ---------------------------------------------------------------------------
// SPDX expression handling
// ---------------------------------------------------------------------------
describe('evaluateLicense – SPDX expressions', () => {
  const commercial: Policy = { preset: 'commercial' };

  it('OR: passes when at least one license is allowed', () => {
    // MIT is allowed in commercial
    const r = evaluateLicense('MIT OR GPL-3.0', commercial);
    expect(r.status).toBe('PASS');
  });

  it('OR: fails when both licenses are denied', () => {
    const r = evaluateLicense('GPL-2.0 OR GPL-3.0', commercial);
    expect(r.status).toBe('FAIL');
  });

  it('OR: reviews when best alternative is review', () => {
    const r = evaluateLicense('MIT OR AFL-3.0', commercial);
    expect(r.status).toBe('PASS'); // MIT is PASS, bestOf(PASS, REVIEW) = PASS
  });

  it('AND: passes only when all licenses are allowed', () => {
    const r = evaluateLicense('MIT AND Apache-2.0', commercial);
    expect(r.status).toBe('PASS');
  });

  it('AND: fails when any license is denied', () => {
    const r = evaluateLicense('MIT AND GPL-3.0', commercial);
    expect(r.status).toBe('FAIL');
  });

  it('AND: reviews when worst license is under review', () => {
    const p: Policy = { allow: ['MIT'], review: ['Apache-2.0'] };
    const r = evaluateLicense('MIT AND Apache-2.0', p);
    expect(r.status).toBe('REVIEW');
  });
});

// ---------------------------------------------------------------------------
// evaluateUnknownLicense / evaluateMissingLicense
// ---------------------------------------------------------------------------
describe('evaluateUnknownLicense', () => {
  it('ignore → PASS', () => {
    const r = evaluateUnknownLicense('ignore');
    expect(r.status).toBe('PASS');
  });

  it('warn → REVIEW', () => {
    const r = evaluateUnknownLicense('warn');
    expect(r.status).toBe('REVIEW');
    expect(r.reasons[0]).toContain('UNKNOWN');
  });

  it('error → FAIL', () => {
    const r = evaluateUnknownLicense('error');
    expect(r.status).toBe('FAIL');
    expect(r.reasons[0]).toContain('UNKNOWN');
  });
});

describe('evaluateMissingLicense', () => {
  it('ignore → PASS', () => {
    expect(evaluateMissingLicense('ignore').status).toBe('PASS');
  });

  it('warn → REVIEW', () => {
    const r = evaluateMissingLicense('warn');
    expect(r.status).toBe('REVIEW');
    expect(r.reasons[0]).toContain('missing');
  });

  it('error → FAIL', () => {
    const r = evaluateMissingLicense('error');
    expect(r.status).toBe('FAIL');
    expect(r.reasons[0]).toContain('missing');
  });
});

// ---------------------------------------------------------------------------
// buildComplianceReport
// ---------------------------------------------------------------------------
describe('buildComplianceReport', () => {
  const policy: Policy = { preset: 'commercial' };

  it('returns PASS overall when all packages pass', () => {
    const report = buildComplianceReport(
      [
        { packageName: 'a@1', license: 'MIT' },
        { packageName: 'b@1', license: 'Apache-2.0' },
      ],
      policy,
      'warn',
      'warn',
    );
    expect(report.overall).toBe('PASS');
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('returns REVIEW overall when there are review packages and no failures', () => {
    const report = buildComplianceReport(
      [
        { packageName: 'a@1', license: 'MIT' },
        { packageName: 'b@1', license: 'AFL-3.0' },
      ],
      policy,
      'warn',
      'warn',
    );
    expect(report.overall).toBe('REVIEW');
    expect(report.errors).toEqual([]);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings[0]).toContain('b@1');
  });

  it('returns FAIL overall when any package fails', () => {
    const report = buildComplianceReport(
      [
        { packageName: 'a@1', license: 'MIT' },
        { packageName: 'b@1', license: 'GPL-3.0' },
      ],
      policy,
      'warn',
      'warn',
    );
    expect(report.overall).toBe('FAIL');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain('b@1');
  });

  it('treats UNKNOWN license according to unknownSeverity', () => {
    const r1 = buildComplianceReport(
      [{ packageName: 'x@1', license: 'UNKNOWN' }],
      policy,
      'ignore',
      'warn',
    );
    expect(r1.overall).toBe('PASS');

    const r2 = buildComplianceReport(
      [{ packageName: 'x@1', license: 'UNKNOWN' }],
      policy,
      'error',
      'warn',
    );
    expect(r2.overall).toBe('FAIL');
  });

  it('treats empty/missing license according to missingSeverity', () => {
    const r1 = buildComplianceReport(
      [{ packageName: 'x@1', license: '' }],
      policy,
      'warn',
      'ignore',
    );
    expect(r1.overall).toBe('PASS');

    const r2 = buildComplianceReport(
      [{ packageName: 'x@1', license: '' }],
      policy,
      'warn',
      'error',
    );
    expect(r2.overall).toBe('FAIL');
  });

  it('populates per-package results in the map', () => {
    const report = buildComplianceReport(
      [
        { packageName: 'a@1', license: 'MIT' },
        { packageName: 'b@1', license: 'GPL-3.0' },
      ],
      policy,
      'warn',
      'warn',
    );
    expect(report.packages.get('a@1')?.status).toBe('PASS');
    expect(report.packages.get('b@1')?.status).toBe('FAIL');
  });
});
