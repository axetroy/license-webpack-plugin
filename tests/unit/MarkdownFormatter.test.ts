import { MarkdownFormatter } from '../../src/formatter/MarkdownFormatter';
import { OutputItem } from '../../src/model/LicenseInfo';

const sampleItems: OutputItem[] = [
  {
    package: {
      name: 'axios',
      version: '1.0.0',
      path: '/node_modules/axios',
      packageJsonPath: '/node_modules/axios/package.json',
      chunks: [],
      modules: [],
    },
    license: { license: 'MIT' },
  },
];

describe('MarkdownFormatter', () => {
  it('generates markdown table', () => {
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(sampleItems);
    expect(result).toContain('# Third Party Licenses');
    expect(result).toContain('| Package | Version | License |');
    expect(result).toContain('| axios | 1.0.0 | MIT |');
    expect(result).toMatchSnapshot();
  });

  it('returns header only for empty items', () => {
    const formatter = new MarkdownFormatter();
    const result = formatter.generate([]);
    expect(result).toContain('# Third Party Licenses');
    expect(result).toContain('| Package | Version | License |');
    expect(result).toContain('|---------|---------|---------|');
    const rowCount = result.split('\n').filter(l => l.startsWith('| ')).length;
    expect(rowCount).toBe(1);
  });

  it('generates rows for multiple items', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'react', version: '18.0.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
      {
        package: { name: 'lodash', version: '4.17.21', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| react | 18.0.0 | MIT |');
    expect(result).toContain('| lodash | 4.17.21 | MIT |');
  });

  it('handles empty/missing version', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'unknown', version: '', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| unknown |  | MIT |');
  });

  it('output ends with newline', () => {
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(sampleItems);
    expect(result.endsWith('\n')).toBe(true);
  });

  it('handles package name with pipe character by including it as-is', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'a|b', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| a|b | 1.0 | MIT |');
  });

  it('includes license text column when any item has licenseText', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg-a', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: 'MIT License Text' },
      },
      {
        package: { name: 'pkg-b', version: '2.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'Apache-2.0' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('| Package | Version | License | License Text |');
    expect(result).toContain('MIT License Text');
    expect(result).toMatchSnapshot();
  });

  it('escapes newlines in license text with <br>', () => {
    const items: OutputItem[] = [
      {
        package: { name: 'pkg', version: '1.0', path: '', packageJsonPath: '', chunks: [], modules: [] },
        license: { license: 'MIT', licenseText: 'Line1\nLine2\nLine3' },
      },
    ];
    const formatter = new MarkdownFormatter();
    const result = formatter.generate(items);
    expect(result).toContain('Line1<br>Line2<br>Line3');
  });
});
