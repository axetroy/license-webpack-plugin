import * as fs from 'fs';
import * as path from 'path';
import webpack = require('webpack');
import { LicenseWebpackPlugin } from '../../dist/LicenseWebpackPlugin';

jest.setTimeout(60000);

function runWebpack(config: webpack.Configuration): Promise<webpack.Stats> {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (!stats) {
        reject(new Error('No stats'));
        return;
      }

      resolve(stats);
    });
  });
}

function prepareOutputDir(name: string): string {
  const outputPath = path.resolve(__dirname, 'output', name);
  fs.rmSync(outputPath, { recursive: true, force: true });
  fs.mkdirSync(outputPath, { recursive: true });
  return outputPath;
}

describe('LicenseWebpackPlugin integration', () => {
  afterAll(() => {
    fs.rmSync(path.resolve(__dirname, 'output'), { recursive: true, force: true });
  });

  it('generates a licenses.txt file with txt format', async () => {
    const outputPath = prepareOutputDir('txt');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.txt',
          format: 'txt',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.txt');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    expect(content).toContain('Third Party Licenses');
    expect(content).toContain('lodash');
  });

  it('generates licenses.json with json format', async () => {
    const outputPath = prepareOutputDir('json');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          filename: 'licenses.json',
          format: 'json',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const licenseFile = path.join(outputPath, 'licenses.json');
    expect(fs.existsSync(path.join(outputPath, 'bundle.js'))).toBe(true);
    expect(fs.existsSync(licenseFile)).toBe(true);
    const content = fs.readFileSync(licenseFile, 'utf-8');
    const parsed = JSON.parse(content) as Array<{ name: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((item) => item.name === 'lodash')).toBe(true);
  });

  it('report-only mode emits JSON report and not the textual license asset', async () => {
    const outputPath = prepareOutputDir('report-only');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          outputMode: 'report-only',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    expect(fs.existsSync(path.join(outputPath, 'licenses.txt'))).toBe(false);
    const reportFile = path.join(outputPath, '.license-webpack-plugin', 'report.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as {
      generatedAt: string;
      packages: Array<{ name: string }>;
    };
    expect(typeof report.generatedAt).toBe('string');
    expect(Array.isArray(report.packages)).toBe(true);
    expect(report.packages.some((pkg) => pkg.name === 'lodash')).toBe(true);
  });

  it('report-only mode with buildName includes buildName in report and uses buildName as default key', async () => {
    const outputPath = prepareOutputDir('report-only-buildname');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          outputMode: 'report-only',
          buildName: 'my-app',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const reportFile = path.join(outputPath, '.license-webpack-plugin', 'my-app.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as {
      buildName: string;
      packages: Array<{ name: string }>;
    };
    expect(report.buildName).toBe('my-app');
  });

  it('report-only mode with custom reportFile uses provided path', async () => {
    const outputPath = prepareOutputDir('report-only-custom');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          outputMode: 'report-only',
          reportFile: 'custom/licenses-report.json',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    const reportFile = path.join(outputPath, 'custom', 'licenses-report.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as {
      packages: Array<{ name: string }>;
    };
    expect(Array.isArray(report.packages)).toBe(true);
  });

  it('aggregate mode with aggregateKey includes aggregateKey in report', async () => {
    const outputPath = prepareOutputDir('aggregate');

    const stats = await runWebpack({
      mode: 'development',
      entry: path.resolve(__dirname, 'fixtures/entry.js'),
      output: {
        path: outputPath,
        filename: 'bundle.js',
      },
      plugins: [
        new LicenseWebpackPlugin({
          outputMode: 'aggregate',
          aggregateKey: 'renderer',
          workspaceRoot: path.resolve(__dirname, '../..'),
        }),
      ],
    });

    expect(stats.hasErrors()).toBe(false);
    expect(fs.existsSync(path.join(outputPath, 'licenses.txt'))).toBe(false);
    const reportFile = path.join(outputPath, '.license-webpack-plugin', 'renderer.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as {
      aggregateKey: string;
      packages: Array<{ name: string }>;
    };
    expect(report.aggregateKey).toBe('renderer');
    expect(Array.isArray(report.packages)).toBe(true);
  });
});
