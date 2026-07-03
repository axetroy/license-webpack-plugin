import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class MarkdownFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const hasLicenseText = items.some((item) => item.license.licenseText);

    const lines: string[] = [
      '# Third Party Licenses',
      '',
      hasLicenseText
        ? '| Package | Version | License | License Text |'
        : '| Package | Version | License |',
      hasLicenseText
        ? '|---------|---------|---------|--------------|'
        : '|---------|---------|---------|',
    ];

    for (const item of items) {
      if (hasLicenseText) {
        const licenseText = item.license.licenseText
          ? item.license.licenseText.replace(/\n/g, '<br>')
          : '';
        lines.push(`| ${item.package.name} | ${item.package.version} | ${item.license.license} | ${licenseText} |`);
      } else {
        lines.push(`| ${item.package.name} | ${item.package.version} | ${item.license.license} |`);
      }
    }

    return `${lines.join('\n')}\n`;
  }
}
