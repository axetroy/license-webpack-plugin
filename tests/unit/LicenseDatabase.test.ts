import { LicenseDatabase } from '../../src/checker/LicenseDatabase';
import { builtInLicenseChecker } from '../../src/checker/BuiltInLicenseChecker';

const { normalizeLicense: _normalizeLicense } = jest.requireActual('../../src/checker/BuiltInLicenseChecker');

jest.mock('../../src/checker/BuiltInLicenseChecker', () => ({
  ...jest.requireActual('../../src/checker/BuiltInLicenseChecker'),
  builtInLicenseChecker: jest.fn(),
}));

const mockedChecker = builtInLicenseChecker as jest.MockedFunction<typeof builtInLicenseChecker>;

function mockCheckerResult(packages: Record<string, unknown>) {
  mockedChecker.mockImplementation((_opts, cb) => {
    cb(null, packages as any);
  });
}

function mockCheckerError(message: string) {
  mockedChecker.mockImplementation((_opts, cb) => {
    cb(new Error(message), {});
  });
}

describe('LicenseDatabase', () => {
  beforeEach(() => {
    mockedChecker.mockClear();
  });

  describe('initialize', () => {
    it('populates cache from checker results', async () => {
      mockCheckerResult({
        'lodash@4.17.21': {
          name: 'lodash',
          version: '4.17.21',
          licenses: 'MIT',
          licenseFile: '/path/LICENSE',
          licenseText: 'MIT License',
          repository: 'https://github.com/lodash/lodash',
          url: 'https://lodash.com',
          publisher: 'John',
          email: 'john@example.com',
          private: false,
        },
      });

      const db = new LicenseDatabase();
      await db.initialize('/workspace');

      const info = db.getLicense('lodash', '4.17.21');
      expect(info.license).toBe('MIT');
      expect(info.licenseFile).toBe('/path/LICENSE');
      expect(info.licenseText).toBe('MIT License');
    });

    it('skips re-initialization when same path is provided', async () => {
      mockCheckerResult({ 'pkg@1.0.0': { name: 'pkg', version: '1.0.0', licenses: 'MIT' } });
      const db = new LicenseDatabase();
      await db.initialize('/workspace');
      await db.initialize('/workspace');
      expect(mockedChecker).toHaveBeenCalledTimes(1);
    });

    it('re-initializes when a different path is provided', async () => {
      mockCheckerResult({ 'pkg@1.0.0': { name: 'pkg', version: '1.0.0', licenses: 'MIT' } });
      const db = new LicenseDatabase();
      await db.initialize('/workspace-a');
      await db.initialize('/workspace-b');
      expect(mockedChecker).toHaveBeenCalledTimes(2);
    });

    it('handles array licenses by joining with AND', async () => {
      mockCheckerResult({
        'dual@1.0.0': { name: 'dual', version: '1.0.0', licenses: ['MIT', 'Apache-2.0'] },
      });
      const db = new LicenseDatabase();
      await db.initialize('/workspace');
      expect(db.getLicense('dual', '1.0.0').license).toBe('MIT AND Apache-2.0');
    });

    it('handles single-element array license', async () => {
      mockCheckerResult({
        'single@1.0.0': { name: 'single', version: '1.0.0', licenses: ['MIT'] },
      });
      const db = new LicenseDatabase();
      await db.initialize('/workspace');
      expect(db.getLicense('single', '1.0.0').license).toBe('MIT');
    });

    it('uses UNKNOWN when licenses field is missing', async () => {
      mockCheckerResult({
        'nolicense@1.0.0': { name: 'nolicense', version: '1.0.0' },
      });
      const db = new LicenseDatabase();
      await db.initialize('/workspace');
      expect(db.getLicense('nolicense', '1.0.0').license).toBe('UNKNOWN');
    });

    it('discards non-string licenseText', async () => {
      mockCheckerResult({
        'pkg@1.0.0': { name: 'pkg', version: '1.0.0', licenses: 'MIT', licenseText: true },
      });
      const db = new LicenseDatabase();
      await db.initialize('/workspace');
      expect(db.getLicense('pkg', '1.0.0').licenseText).toBeUndefined();
    });

    it('discards empty string licenseText', async () => {
      mockCheckerResult({
        'pkg@1.0.0': { name: 'pkg', version: '1.0.0', licenses: 'MIT', licenseText: '' },
      });
      const db = new LicenseDatabase();
      await db.initialize('/workspace');
      expect(db.getLicense('pkg', '1.0.0').licenseText).toBeUndefined();
    });

    it('re-throws checker errors', async () => {
      mockCheckerError('checker failed');
      const db = new LicenseDatabase();
      await expect(db.initialize('/workspace')).rejects.toThrow('checker failed');
    });
  });

  describe('getLicense', () => {
    it('returns cached license when available', async () => {
      mockCheckerResult({ 'pkg@1.0.0': { name: 'pkg', version: '1.0.0', licenses: 'MIT' } });
      const db = new LicenseDatabase();
      await db.initialize('/workspace');
      expect(db.getLicense('pkg', '1.0.0').license).toBe('MIT');
    });

    it('returns UNKNOWN fallback when not in cache', () => {
      const db = new LicenseDatabase();
      const info = db.getLicense('missing', '0.0.0');
      expect(info.license).toBe('UNKNOWN');
    });
  });

});
