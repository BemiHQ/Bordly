import * as cheerio from 'cheerio';

import { Domain } from '@/entities/domain';
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
  // CORS issues
  'getsentry.com': '/domain-icons/getsentry.com.svg',
  'instagram.com': '/domain-icons/instagram.com.png',
  'gusto.com': '/domain-icons/gusto.com.png',
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
  static async findAndBuildDomainByName(domainNames: string[]) {
    if (domainNames.length === 0) return {};

    const domains = await orm.em.find(Domain, { name: { $in: domainNames } });
    const domainByName: Record<string, Domain> = {};
    for (const domain of domains) {
      domainByName[domain.name] = domain;
    }
    return domainByName;
  }

  static async fetchIconUrl(domain: Domain) {
    if (domain.iconUrl) {
      return domain.iconUrl;
    }

    let foundIconUrl: string | undefined;

    const rootDomainName = domain.name
      .split('.')
      .slice(DOUBLE_DOMAIN_NAMESPACES.some((ns) => domain.name.endsWith(`.${ns}`)) ? -3 : -2)
      .join('.'); // e.g., sub.example.com -> example.com, sub.example.co.uk -> example.co.uk

    if (SKIP_CONSUMER_DOMAINS.includes(rootDomainName)) {
      // Skip
    } else if (CUSTOM_ROOT_DOMAIN_ICONS[rootDomainName]) {
      foundIconUrl = CUSTOM_ROOT_DOMAIN_ICONS[rootDomainName];
    } else {
      // Try `${rootDomainName}/favicon.ico` first
      try {
        const faviconUrl = `https://${rootDomainName}/favicon.ico`;
        const response = await DomainService.sendGet(faviconUrl);
        if (response.ok && response.url.endsWith('/favicon.ico') && DomainService.allowedCORS(response)) {
          foundIconUrl = response.url;
        }
      } catch (_error) {}

      // If not found, go to `https://${rootDomainName}` and search for <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
      if (!foundIconUrl) {
        try {
          const response = await DomainService.sendGet(`https://${rootDomainName}`);
          if (response.ok && DomainService.allowedCORS(response)) {
            const html = await response.text();
            const $ = cheerio.load(html);
            const iconLink = $('link[rel="icon"], link[rel="shortcut icon"]').first();
            if (iconLink.length) {
              const href = iconLink.attr('href');
              if (href) {
                foundIconUrl = href.startsWith('http')
                  ? href
                  : new URL(href, `https://${new URL(response.url).hostname}`).href; // Handle relative URLs
              }
            }
          }
        } catch (_error) {} // Could not fetch or parse HTML
      }
    }

    return foundIconUrl;
  }

  private static allowedCORS(response: Response) {
    const result =
      response.headers.get('Access-Control-Allow-Origin') === '*' ||
      !response.headers.get('Access-Control-Allow-Origin');

    if (!result) {
      console.log(
        `[FETCH] Skipping due to CORS restrictions: ${response.url} (${response.headers.get('Access-Control-Allow-Origin')})`,
      );
    }

    return result;
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
