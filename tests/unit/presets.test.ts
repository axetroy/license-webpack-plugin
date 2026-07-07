import { describe, it, expect } from '@jest/globals';
import { resolvePolicy, getDefaultPolicy } from '../../src/compliance/presets.js';
import type { Policy } from '../../src/compliance/types.js';

describe('resolvePolicy', () => {
  it('returns allow/review/deny from preset when no custom lists given', () => {
    const r = resolvePolicy({ preset: 'commercial' });
    expect(r.preset).toBe('commercial');
    expect(r.allow).toContain('MIT');
    expect(r.allow).toContain('LGPL-2.1');
    expect(r.deny).toContain('GPL-3.0');
    expect(r.review).toEqual([]);
  });

  it('merges custom allow over preset allow', () => {
    const r = resolvePolicy({ preset: 'commercial', allow: ['MIT'] });
    expect(r.allow).toEqual(['MIT']);
    // Deny list still comes from commercial preset
    expect(r.deny).toContain('GPL-3.0');
  });

  it('merges custom deny over preset deny', () => {
    const r = resolvePolicy({ preset: 'commercial', deny: ['MIT'] });
    expect(r.deny).toEqual(['MIT']);
  });

  it('merges custom review list', () => {
    const r = resolvePolicy({ preset: 'commercial', review: ['MPL-2.0'] });
    expect(r.review).toContain('MPL-2.0');
  });

  it('handles no preset with custom lists', () => {
    const r = resolvePolicy({ allow: ['MIT'], deny: ['GPL-3.0'] });
    expect(r.preset).toBeUndefined();
    expect(r.allow).toEqual(['MIT']);
    expect(r.deny).toEqual(['GPL-3.0']);
    expect(r.review).toEqual([]);
  });

  it('handles empty policy (no preset, no lists)', () => {
    const r = resolvePolicy({});
    expect(r.preset).toBeUndefined();
    expect(r.allow).toEqual([]);
    expect(r.deny).toEqual([]);
    expect(r.review).toEqual([]);
  });

  it('permissive preset has permissive licenses in allow', () => {
    const r = resolvePolicy({ preset: 'permissive' });
    expect(r.allow).toContain('MIT');
    expect(r.allow).toContain('Apache-2.0');
    expect(r.allow).toContain('BSL-1.0');
    expect(r.allow).toContain('Zlib');
    expect(r.allow).toContain('Artistic-2.0');
    expect(r.allow).toContain('BlueOak-1.0.0');
    expect(r.allow).not.toContain('GPL-3.0');
  });

  it('commercial preset allows weak copyleft', () => {
    const r = resolvePolicy({ preset: 'commercial' });
    expect(r.allow).toContain('LGPL-2.1');
    expect(r.allow).toContain('MPL-2.0');
    expect(r.allow).toContain('EPL-2.0');
    expect(r.allow).toContain('CDDL-1.0');
    expect(r.allow).toContain('EUPL-1.2');
  });

  it('enterprise preset has deny list with copyleft licenses', () => {
    const r = resolvePolicy({ preset: 'enterprise' });
    expect(r.allow).toContain('MIT');
    expect(r.deny).toContain('GPL-3.0');
    expect(r.deny).toContain('LGPL-2.1');
    expect(r.deny).toContain('EPL-2.0');
    expect(r.deny).toContain('AGPL-3.0');
  });

  it('strong copyleft presets deny GPL/AGPL/SSPL variants', () => {
    const r = resolvePolicy({ preset: 'commercial' });
    expect(r.deny).toContain('GPL-2.0');
    expect(r.deny).toContain('AGPL-3.0');
    expect(r.deny).toContain('AGPL-1.0');
    expect(r.deny).toContain('SSPL-1.0');
    expect(r.deny).toContain('OSL-3.0');
    expect(r.deny).toContain('RPL-1.5');
  });

  it('oss preset has empty lists', () => {
    const r = resolvePolicy({ preset: 'oss' });
    expect(r.allow).toEqual([]);
    expect(r.deny).toEqual([]);
    expect(r.review).toEqual([]);
  });

  it('strict preset has empty lists by default', () => {
    const r = resolvePolicy({ preset: 'strict' });
    expect(r.allow).toEqual([]);
    expect(r.deny).toEqual([]);
    expect(r.review).toEqual([]);
  });

  it('none preset has empty lists', () => {
    const r = resolvePolicy({ preset: 'none' });
    expect(r.allow).toEqual([]);
    expect(r.deny).toEqual([]);
    expect(r.review).toEqual([]);
  });
});

describe('getDefaultPolicy', () => {
  it('returns commercial preset', () => {
    const p = getDefaultPolicy();
    expect(p).toEqual({ preset: 'commercial' });
  });
});
