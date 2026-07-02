import * as fs from 'fs';
import * as path from 'path';
import { PackageInfo } from '../model/PackageInfo';

export class PackageResolver {
  resolve(modulePath: string, chunkName: string): PackageInfo | null {
    if (!modulePath || !modulePath.includes('node_modules')) {
      return null;
    }

    const normalizedPath = modulePath.replace(/\\/g, '/');
    const nodeModulesIdx = normalizedPath.lastIndexOf('/node_modules/');
    if (nodeModulesIdx === -1) {
      return null;
    }

    const afterNodeModules = normalizedPath.slice(nodeModulesIdx + '/node_modules/'.length);

    let packageName: string;
    if (afterNodeModules.startsWith('@')) {
      const parts = afterNodeModules.split('/');
      if (parts.length < 2) {
        return null;
      }
      packageName = `${parts[0]}/${parts[1]}`;
    } else {
      const [name] = afterNodeModules.split('/');
      if (!name) {
        return null;
      }
      packageName = name;
    }

    const packageRoot = path.join(
      normalizedPath.slice(0, nodeModulesIdx + '/node_modules/'.length).replace(/\//g, path.sep),
      packageName.replace(/\//g, path.sep)
    );
    const packageJsonPath = path.join(packageRoot, 'package.json');

    try {
      const rawContent = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(rawContent) as {
        name?: string;
        version?: string;
        repository?: string | { url?: string; type?: string };
        homepage?: string;
        author?: string | { name?: string; email?: string };
        private?: boolean;
      };

      let repository: string | undefined;
      if (pkg.repository) {
        if (typeof pkg.repository === 'string') {
          repository = pkg.repository
            .replace(/^git\+https:\/\//, 'https://')
            .replace(/^git:\/\//, 'https://')
            .replace(/^git\+ssh:\/\/git@/, 'https://')
            .replace(/^git\+ssh:\/\//, 'https://')
            .replace(/\.git$/, '');
        } else if (typeof pkg.repository === 'object' && pkg.repository.url) {
          repository = pkg.repository.url;
        }
      }

      let author: string | undefined;
      let publisher: string | undefined;
      if (pkg.author) {
        if (typeof pkg.author === 'string') {
          const match = pkg.author.match(/^(.+?)(?:\s*<([^>]+)>)?$/);
          if (match) {
            publisher = match[1].trim();
            author = match[2] ? `${match[1].trim()} <${match[2]}>` : match[1].trim();
          }
        } else if (typeof pkg.author === 'object') {
          publisher = pkg.author.name;
          author = pkg.author.email ? `${pkg.author.name} <${pkg.author.email}>` : pkg.author.name;
        }
      }

      return {
        name: pkg.name || packageName,
        version: pkg.version || 'unknown',
        path: packageRoot,
        packageJsonPath,
        chunks: [chunkName],
        modules: [modulePath],
        repository,
        homepage: pkg.homepage,
        author,
        publisher,
        private: pkg.private === true,
      };
    } catch {
      return null;
    }
  }
}
