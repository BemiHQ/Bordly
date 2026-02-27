import DOMPurify from 'dompurify';
import { API_ENDPOINTS } from '@/utils/urls';

type Attachment = {
  id: string;
  mimeType: string;
  filename: string;
  contentId: string | null | undefined;
};

const extractDomain = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------------------------------------------------

export const sanitizedDisplayHtml = ({
  html,
  gmailAttachments,
  boardId,
  boardCardId,
}: {
  html: string;
  gmailAttachments: Attachment[];
  boardId: string;
  boardCardId: string;
}) => {
  const sanitized = DOMPurify.sanitize(html, {
    ADD_TAGS: ['style'],
    ADD_ATTR: ['style'],
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/html');

  // Replace cid: references with proxy URLs for inline images
  for (const attachment of gmailAttachments) {
    if (!attachment.mimeType.startsWith('image/') || (!attachment.filename && !attachment.contentId)) continue;

    const proxyUrl = `${API_ENDPOINTS.PROXY_GMAIL_ATTACHMENT}?boardId=${boardId}&boardCardId=${boardCardId}&gmailAttachmentId=${attachment.id}`;
    const images = doc.body.querySelectorAll('img');
    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (
        src &&
        ((attachment.filename && src === `cid:${attachment.filename}`) ||
          (attachment.contentId && src === `cid:${attachment.contentId}`))
      ) {
        img.setAttribute('src', proxyUrl);
      }
    });
  }

  // Remove tracking images from blocklist and detect suspicious trackers
  const blockedTrackerDomains = new Set<string>();
  const images = doc.body.querySelectorAll('img');
  images.forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;

    const widthAttr = img.getAttribute('width');
    const heightAttr = img.getAttribute('height');
    const style = img.getAttribute('style');

    let width = widthAttr;
    let height = heightAttr;

    if (style) {
      const widthMatch = style.match(/(?:^|;)\s*width:\s*([^;]+)/);
      const heightMatch = style.match(/(?:^|;)\s*height:\s*([^;]+)/);
      if (widthMatch && !width) {
        width = widthMatch[1].trim();
      }
      if (heightMatch && !height) {
        height = heightMatch[1].trim();
      }
    }

    const isZeroOrOnePx =
      width &&
      (width === '0' || width === '1' || width === '0px' || width === '1px') &&
      height &&
      (height === '0' || height === '1' || height === '0px' || height === '1px');

    if (isZeroOrOnePx) {
      const domain = extractDomain(src);
      if (domain) {
        blockedTrackerDomains.add(domain);
      }
      img.remove();
    }
  });

  return {
    displayHtml: doc.body.innerHTML,
    blockedTrackerDomains: Array.from(blockedTrackerDomains),
  };
};
