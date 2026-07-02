import { LicensePluginCore } from './LicensePluginCore';
import type { LicensePluginOptions } from './LicensePluginCore';
import { PackageResolver } from './scanner/PackageResolver';
import type { PackageInfo } from './model/PackageInfo';

const PLUGIN_NAME = 'vite-license-plugin';

// Minimal Plugin interface so Vite is not needed at compile time.
interface VitePlugin {
  name: string;
  enforce?: 'pre' | 'post';
  buildStart?: () => void | Promise<void>;
  resolveId?: (id: string, importer: string | undefined) => string | null | undefined | void;
  transform?: (code: string, id: string) => string | null | undefined | void;
  generateBundle?: (opts: unknown, bundle: unknown) => void | Promise<void>;
}

export function viteLicensePlugin(options: LicensePluginOptions = {}): VitePlugin {
  const core = new LicensePluginCore(options);
  const resolver = new PackageResolver();
  const resolvedPackages = new Map<string, PackageInfo>();

  return {
    name: PLUGIN_NAME,

    enforce: 'post',

    async buildStart() {
      const root = options.workspaceRoot || process.cwd();
      const context = {
        reportError: (msg: string) => { throw new Error(msg); },
        reportWarning: (msg: string) => console.warn(`[${PLUGIN_NAME}] ${msg}`),
      };
      await core.initialize(root, context);
    },

    resolveId(id: string, importer: string | undefined) {
      if (!importer || id.startsWith('\0') || id.startsWith('virtual:')) return null;
      return null;
    },

    transform(_code: string, id: string) {
      if (!id.includes('node_modules')) return null;

      const pkgInfo = resolver.resolve(id, 'main');
      if (pkgInfo) {
        const key = `${pkgInfo.name}@${pkgInfo.version}`;
        if (!resolvedPackages.has(key)) {
          resolvedPackages.set(key, pkgInfo);
        }
      }
      return null;
    },

    async generateBundle() {
      if (resolvedPackages.size === 0) return;

      const warnings: string[] = [];
      const context = {
        reportError: (msg: string) => { throw new Error(msg); },
        reportWarning: (msg: string) => warnings.push(msg),
      };

      const { items } = await core.generateLicenseItems(resolvedPackages, context);
      const source = core.format(items);

      // Rollup/Vite 8 compatible emit
      const outputOptions = { file: core.options.filename, source };
      (this as unknown as { emitFile: (opts: { type: string; fileName: string; source: string }) => void }).emitFile({
        type: 'asset',
        fileName: core.options.filename,
        source,
      });

      for (const w of warnings) {
        console.warn(`[${PLUGIN_NAME}] ${w}`);
      }
    },
  };
}
