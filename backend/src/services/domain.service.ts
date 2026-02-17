import * as cheerio from 'cheerio';

import { Domain } from '@/entities/domain';
import { orm } from '@/utils/orm';

export class DomainService {
  static async setIcons(domainNames: string[]) {
    const existingDomains = await orm.em.find(Domain, {
      name: { $in: domainNames },
    });

    const domainByName: Record<string, Domain> = {};
    for (const domain of existingDomains) {
      domainByName[domain.name] = domain;
    }

    for (const domainName of domainNames) {
      if (domainByName[domainName]?.iconUrl) continue;

      let foundIconUrl: string | undefined;

      // Try `${domainName}/favicon.ico` first
      try {
        const faviconUrl = `https://${domainName}/favicon.ico`;
        const faviconResponse = await fetch(faviconUrl, {
          method: 'HEAD',
          redirect: 'follow',
        });
        if (faviconResponse.ok) foundIconUrl = faviconUrl;
      } catch (_error) {}

      // If not found, go to `https://${domainName}` and search for <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
      if (!foundIconUrl) {
        try {
          const response = await fetch(`https://${domainName}`, {
            redirect: 'follow',
          });
          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            const iconLink = $('link[rel="icon"], link[rel="shortcut icon"]').first();
            if (iconLink.length) {
              const href = iconLink.attr('href');
              if (href) {
                foundIconUrl = href.startsWith('http') ? href : new URL(href, `https://${domainName}`).href; // Handle relative URLs
              }
            }
          }
        } catch (_error) {} // Could not fetch or parse HTML
      }

      if (foundIconUrl || !domainByName[domainName]) {
        const domain = domainByName[domainName] || new Domain({ name: domainName });
        domain.iconUrl = foundIconUrl;

        await orm.em.persist(domain).flush();
        domainByName[domainName] = domain;
      }
    }
  }
}
