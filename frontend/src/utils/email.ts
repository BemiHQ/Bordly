import DOMPurify from 'dompurify';
import { shortDateTime } from '@/utils/time';
import { API_ENDPOINTS } from '@/utils/urls';

type Attachment = {
  id: string;
  mimeType: string;
  filename: string;
  contentId: string | null | undefined;
};

const textToHtml = (text: string): string => {
  return text
    .split('\n')
    .map((line) => `<div>${line || '<br>'}</div>`)
    .join('');
};

// ---------------------------------------------------------------------------------------------------------------------

export const sanitizedDisplayHtml = ({
  bodyHtml,
  gmailAttachments,
  boardId,
  boardCardId,
}: {
  bodyHtml: string;
  gmailAttachments: Attachment[];
  boardId: string;
  boardCardId: string;
}): string => {
  const sanitized = DOMPurify.sanitize(bodyHtml, {
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

  return doc.body.innerHTML;
};

export const formattedQuoteHeader = ({
  from,
  sentAt,
}: {
  from: { name: string | null; email: string };
  sentAt: Date;
}): string => {
  const dayOfWeek = sentAt.toLocaleDateString('en-US', { weekday: 'short' });
  const formattedDate = shortDateTime(sentAt);

  return (
    `On ${dayOfWeek}, ${formattedDate} ` +
    `${from.name || from.email} ` +
    `<<a href="mailto:${from.email}" target="_blank" rel="noopener noreferrer">${from.email}</a>> wrote:`
  );
};

export const createQuotedHtml = ({
  html,
  text,
  quoteHeader,
}: {
  html: string;
  text: string;
  quoteHeader: string;
}): string => {
  return `
<div class="gmail_quote">
  <div dir="ltr" class="gmail_attr">${quoteHeader}<br></div>
  <blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
    ${html || (text ? textToHtml(text) : '')}
  </blockquote>
</div>`;
};
