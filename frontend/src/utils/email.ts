import DOMPurify from 'dompurify';
import { shortDateTime } from '@/utils/time';
import { API_ENDPOINTS } from '@/utils/urls';

type Attachment = {
  id: string;
  mimeType: string;
  filename: string;
  contentId: string | null | undefined;
};

export const sanitizeBodyHtml = ({
  bodyHtml,
  attachments,
  boardId,
  boardCardId,
}: {
  bodyHtml: string;
  attachments: Attachment[];
  boardId: string;
  boardCardId: string;
}): { html: string; styles: string } => {
  const sanitized = DOMPurify.sanitize(bodyHtml, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'head'],
    ADD_ATTR: ['style'],
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/html');

  // Replace cid: references with proxy URLs for inline images using DOM
  for (const attachment of attachments) {
    if (!attachment.mimeType.startsWith('image/') || (!attachment.filename && !attachment.contentId)) continue;

    const proxyUrl = `${API_ENDPOINTS.PROXY_GMAIL_ATTACHMENT}?boardId=${boardId}&boardCardId=${boardCardId}&attachmentId=${attachment.id}`;
    const images = doc.body.querySelectorAll('img');
    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src) {
        if (attachment.filename && src === `cid:${attachment.filename}`) {
          img.setAttribute('src', proxyUrl);
        }
        if (attachment.contentId && src === `cid:${attachment.contentId}`) {
          img.setAttribute('src', proxyUrl);
        }
      }
    });
  }

  const html = doc.body.innerHTML;

  // Get head styles
  const styles = Array.from(doc.head.querySelectorAll('style'))
    .map((style) => style.textContent || '')
    .join('\n');

  return { html, styles };
};

export const formatQuoteHeader = ({
  from,
  sentAt,
}: {
  from: { name: string | null; email: string };
  sentAt: string | Date;
}): string => {
  const date = typeof sentAt === 'string' ? new Date(sentAt) : sentAt;
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const formattedDate = shortDateTime(date);

  return `On ${dayOfWeek}, ${formattedDate} ${from.name || from.email} <${from.email}> wrote:`;
};

const textToHtml = (text: string): string => {
  return text
    .split('\n')
    .map((line) => `<div>${line || '<br>'}</div>`)
    .join('');
};

export const createQuotedHtml = ({
  bodyHtml,
  bodyText,
  quoteHeader,
}: {
  bodyHtml: string;
  bodyText: string | null | undefined;
  quoteHeader: string;
}): string => {
  const quotedContent = bodyHtml || (bodyText ? textToHtml(bodyText) : '');
  return `<div>${quoteHeader}</div><blockquote>${quotedContent}</blockquote>`;
};
