import * as cheerio from 'cheerio';

import { Domain } from '@/entities/domain';
import { mapBy } from '@/utils/lists';
import { orm } from '@/utils/orm';

const REQUEST_TIMEOUT_MS = 3_000;

const SKIP_CONSUMER_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
  'hey.com',
];

const CUSTOM_ROOT_DOMAIN_ICONS = {
  // 400 Bad Request
  'gusto.com': '/domain-icons/gusto.com.ico',
  // 429 Too Many Requests
  'brex.com': '/domain-icons/brex.com.ico',
  // 500 Internal Server Error
  'remote-comms.com': '/domain-icons/remote.com.ico',
} as Record<string, string>;

const DOUBLE_DOMAIN_NAMESPACES = [
  'co.uk',
  'ac.uk',
  'org.uk',
  'gov.uk',
  'com.br',
  'net.br',
  'org.br',
  'gov.br',
  'edu.br',
  'art.br',
  'vet.br',
  'wiki.br',
  'bet.br',
  'com.au',
  'edu.au',
  'org.au',
  'gov.au',
  'asn.au',
  'co.jp',
  'ac.jp',
  'co.in',
  'ac.in',
  'co.nz',
  'ac.nz',
  'co.za',
  'co.ao',
  'co.bb',
  'co.ca',
  'co.ck',
  'co.cr',
];

export class DomainService {
  static async findDomainByName(domainNames: string[]) {
    if (domainNames.length === 0) return {};
    const domains = await orm.em.find(Domain, { name: { $in: domainNames } });
    return mapBy(domains, (domain) => domain.name);
  }

  static async fetchIcon(domain: Domain) {
    if (domain.iconUrl) {
      return { iconUrl: domain.iconUrl };
    }

    let iconUrl: string | undefined;
    let fetchErrorStatus: number | undefined;

    const rootDomainName = domain.name
      .split('.')
      .slice(DOUBLE_DOMAIN_NAMESPACES.some((ns) => domain.name.endsWith(`.${ns}`)) ? -3 : -2)
      .join('.'); // e.g., sub.example.com -> example.com, sub.example.co.uk -> example.co.uk

    if (SKIP_CONSUMER_DOMAINS.includes(rootDomainName)) {
      // Skip
    } else if (CUSTOM_ROOT_DOMAIN_ICONS[rootDomainName]) {
      iconUrl = CUSTOM_ROOT_DOMAIN_ICONS[rootDomainName];
    } else {
      // Try `${rootDomainName}/favicon.ico` first
      try {
        const faviconUrl = `https://${rootDomainName}/favicon.ico`;
        const response = await DomainService.sendGet(faviconUrl);
        if (response.ok && response.url.endsWith('/favicon.ico')) {
          iconUrl = response.url;
        } else if (!response.ok) {
          fetchErrorStatus = response.status;
        }
      } catch (_error) {}

      // If not found, go to `https://${rootDomainName}` and search for <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
      if (!iconUrl) {
        try {
          const response = await DomainService.sendGet(`https://${rootDomainName}`);
          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            const iconLink = $('link[rel="icon"], link[rel="shortcut icon"]').first();
            if (iconLink.length) {
              const href = iconLink.attr('href');
              if (href) {
                iconUrl = href.startsWith('http')
                  ? href
                  : new URL(href, `https://${new URL(response.url).hostname}`).href; // Handle relative URLs
              }
            }
          } else {
            fetchErrorStatus = response.status;
          }
        } catch (_error) {} // Could not fetch or parse HTML
      }
    }

    return { iconUrl, fetchErrorStatus };
  }

  private static async sendGet(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS); // 5 seconds timeout

    try {
      console.log(`[FETCH] URL: ${url}`);
      const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      if (!response.ok) console.log(`[FETCH] ${url} returned ${response.status}`);
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}
