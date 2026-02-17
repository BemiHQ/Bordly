import * as cheerio from 'cheerio';

import { Domain } from '@/entities/domain';
import { orm } from '@/utils/orm';

const REQUEST_TIMEOUT_MS = 5_000;

const CUSTOM_ROOT_DOMAIN_ICONS = {
  // CORS issues
  'getsentry.com': '/domain-icons/getsentry.com.svg',
  'instagram.com': '/domain-icons/instagram.com.png',
} as Record<string, string>;

export class DomainService {
  static async findDomainIconUrlByName(domainNames: string[]) {
    const domains = await orm.em.find(Domain, { name: { $in: domainNames } });
    const domainIconUrlByName: Record<string, string> = {};
    for (const domain of domains) {
      if (domain.iconUrl) {
        domainIconUrlByName[domain.name] = domain.iconUrl;
      }
    }
    return domainIconUrlByName;
  }

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

      const rootDomainName = domainName.split('.').slice(-2).join('.'); // e.g., sub.example.com -> example.com
      if (CUSTOM_ROOT_DOMAIN_ICONS[rootDomainName]) {
        foundIconUrl = CUSTOM_ROOT_DOMAIN_ICONS[rootDomainName];
      } else {
        // Try `${rootDomainName}/favicon.ico` first
        try {
          const faviconUrl = `https://${rootDomainName}/favicon.ico`;
          const response = await DomainService.sendGet(faviconUrl);
          if (response.ok) foundIconUrl = response.url;
        } catch (_error) {}
        // If not found, go to `https://${rootDomainName}` and search for <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
        if (!foundIconUrl) {
          try {
            const response = await DomainService.sendGet(`https://${rootDomainName}`);
            if (response.ok) {
              const html = await response.text();
              const $ = cheerio.load(html);

              const iconLink = $('link[rel="icon"], link[rel="shortcut icon"]').first();
              if (iconLink.length) {
                const href = iconLink.attr('href');
                if (href) {
                  const finalDomainName = new URL(response.url).hostname;
                  foundIconUrl = href.startsWith('http') ? href : new URL(href, `https://${finalDomainName}`).href; // Handle relative URLs
                }
              }
            }
          } catch (_error) {} // Could not fetch or parse HTML
        }
      }

      if (foundIconUrl || !domainByName[domainName]) {
        const domain = domainByName[domainName] || new Domain({ name: domainName });
        domain.iconUrl = foundIconUrl;

        orm.em.persist(domain);
        domainByName[domainName] = domain;
      }
    }

    await orm.em.flush();
  }

  private static async sendGet(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS); // 5 seconds timeout

    try {
      console.log(`Fetching URL: ${url}`);
      const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}
