import DOMPurify from 'dompurify';
import { API_ENDPOINTS } from '@/utils/urls';

type Attachment = {
  id: string;
  mimeType: string;
  filename: string;
  contentId: string | null | undefined;
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
