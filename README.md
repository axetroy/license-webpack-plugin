# license-webpack-plugin

A webpack 5 plugin that generates third-party license notices for packages that are actually bundled into your final build.

## Features

- Scans the final webpack module graph for used npm packages
- Reads license metadata with `license-checker-rseidelsohn`
- Emits TXT, JSON, Markdown, or HTML assets at build time
- Supports compliance rules with `onlyAllow` and `failOn`
- Works with webpack 5 `processAssets`

## Installation

```bash
npm install license-webpack-plugin webpack
```

## Usage

```js
const { LicenseWebpackPlugin } = require('license-webpack-plugin');

module.exports = {
  mode: 'production',
  plugins: [
    new LicenseWebpackPlugin({
      filename: 'third-party-licenses.txt',
      format: 'txt',
      includeLicenseText: true,
      onlyAllow: ['MIT', 'Apache-2.0', 'BSD-3-Clause'],
    }),
  ],
};
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `filename` | `string` | `licenses.txt` | Output asset name |
| `format` | `'txt' \| 'json' \| 'markdown' \| 'html'` | `txt` | Output format |
| `includeLicenseText` | `boolean` | `true` | Include license text when supported |
| `includeRepository` | `boolean` | `true` | Include repository URLs |
| `includeHomepage` | `boolean` | `true` | Include homepage URLs |
| `includeAuthor` | `boolean` | `true` | Include author/publisher details |
| `includePackages` | `string[]` | `[]` | Only include listed packages |
| `excludePackages` | `string[]` | `[]` | Exclude listed packages |
| `includeLicenses` | `string[]` | `[]` | Only include listed licenses |
| `excludeLicenses` | `string[]` | `[]` | Exclude listed licenses |
| `onlyAllow` | `string[]` | `[]` | Fail build when a used license is not allowed |
| `failOn` | `string[]` | `[]` | Fail build when a used license matches the list |
| `includeChunks` | `string[]` | `[]` | Only include packages used by specific chunks |
| `sort` | `boolean` | `true` | Sort packages by name |
| `deduplicateLicense` | `boolean` | `true` | Suppress repeated license text bodies |
| `cache` | `boolean` | `true` | Reuse the in-memory license database |
| `workspaceRoot` | `string` | `compiler.context` | Root path passed to license-checker |
| `outputMode` | `'per-compilation' \| 'report-only' \| 'aggregate'` | `per-compilation` | Controls what asset is emitted (see below) |
| `buildName` | `string` | `''` | Optional name for this build; used as default report file key and included in the JSON report |
| `reportFile` | `string` | `.license-webpack-plugin/<key>.json` | Asset path for the structured JSON report emitted in `report-only` and `aggregate` modes |
| `aggregateKey` | `string` | `''` | Namespace key for the report in `aggregate` mode; takes precedence over `buildName` as the default file key |
| `emitMergedAsset` | `boolean` | `false` | Reserved for future use |

## Output modes

### `per-compilation` (default)
Standard behavior: emits the configured textual license asset (TXT, JSON, Markdown, or HTML) on every build.

### `report-only`
Does **not** emit the textual license file. Instead emits a structured JSON report at the path given by `reportFile`, or `.license-webpack-plugin/<buildName|'report'>.json` by default. Useful for CI pipelines that consume machine-readable data without bundling the text asset.

```js
new LicenseWebpackPlugin({
  outputMode: 'report-only',
  buildName: 'renderer',
  // report emitted to: .license-webpack-plugin/renderer.json
});
```

### `aggregate`
Same as `report-only` but uses `aggregateKey` (falling back to `buildName`) to namespace the report file, and includes `aggregateKey` in the JSON payload. Intended for multi-compiler / multi-build workflows where each build writes its own keyed report.

```js
// main process build
new LicenseWebpackPlugin({ outputMode: 'aggregate', aggregateKey: 'main' });
// renderer process build
new LicenseWebpackPlugin({ outputMode: 'aggregate', aggregateKey: 'renderer' });
```

### Structured JSON report format

```json
{
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "buildName": "renderer",
  "aggregateKey": "renderer",
  "packages": [
    {
      "name": "lodash",
      "version": "4.17.21",
      "license": "MIT",
      "repository": "https://github.com/lodash/lodash",
      "homepage": "https://lodash.com/",
      "author": "John-David Dalton",
      "licenseText": "..."
    }
  ]
}
```

`buildName` and `aggregateKey` are only present when configured.

## Output formats

### TXT
Human-readable notice file for app distribution.

### JSON
Machine-readable output for CI, audits, and internal tooling.

### Markdown
Useful for GitHub releases or repository documentation.

### HTML
Useful for Electron about pages and in-app license views.

## Compliance examples

```js
new LicenseWebpackPlugin({
  onlyAllow: ['MIT', 'Apache-2.0'],
});

new LicenseWebpackPlugin({
  failOn: ['GPL-3.0', 'AGPL-3.0'],
});
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
