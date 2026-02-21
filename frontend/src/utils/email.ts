import DOMPurify from 'dompurify';
import { shortDateTime } from '@/utils/time';
import { API_ENDPOINTS } from '@/utils/urls';

type Attachment = {
  id: string;
  mimeType: string;
  filename: string;
  contentId: string | null | undefined;
};

const FORWARDED_MESSAGE_REGEX = /^-+\s*Forwarded message\s*-+/i;
const QUOTE_HEADER_REGEX = /On\s+.+\s+wrote:|^-+\s*Forwarded message\s*-+/i;

const isNonEmptyNode = (node: ChildNode) =>
  node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent?.trim());

const isQuoteHeader = (text: string): boolean => QUOTE_HEADER_REGEX.test(text);
const isForwardedHeader = (text: string): boolean => FORWARDED_MESSAGE_REGEX.test(text);

// Check if an element is a quote container (has "On ... wrote:" or forwarded message header child followed by blockquote or blockquote wrapper)
// Returns the indices of the header and blockquote wrapper elements if found
const findQuoteContainerChildren = (elem: Element): { onWroteIndex: number; blockquoteIndex: number } | null => {
  const children = Array.from(elem.childNodes).filter(isNonEmptyNode);

  for (let i = 0; i < children.length - 1; i++) {
    if (children[i].nodeType === Node.ELEMENT_NODE && children[i + 1].nodeType === Node.ELEMENT_NODE) {
      const text = (children[i] as Element).textContent?.trim() || '';
      const nextElem = children[i + 1] as Element;
      if (isQuoteHeader(text) && (nextElem.tagName === 'BLOCKQUOTE' || nextElem.querySelector('blockquote'))) {
        return { onWroteIndex: i, blockquoteIndex: i + 1 };
      }
    }
  }
  return null;
};

const findGmailQuote = (elem: Element): Element | null => {
  const isGmailQuote = elem.classList.contains('gmail_quote') && !!elem.querySelector('blockquote');
  if (isGmailQuote) return elem;

  const nested = elem.querySelector('.gmail_quote');
  return nested?.querySelector('blockquote') ? nested : null;
};

// Remove trailing empty elements like <div><br></div>. This includes nested empty elements within containers
const hasVisibleContent = (elem: Element): boolean => {
  if (elem.textContent?.trim()) {
    return true;
  }
  const visibleTags = ['IMG', 'VIDEO', 'AUDIO', 'IFRAME', 'SVG', 'CANVAS', 'HR'];
  if (visibleTags.includes(elem.tagName)) {
    return true;
  }
  return Array.from(elem.children).some(hasVisibleContent);
};

// Check if there's any visible content before a given index in the children list
const hasVisibleContentBefore = (children: ChildNode[], beforeIndex: number): boolean => {
  return children.slice(0, beforeIndex).some((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !!node.textContent?.trim();
    if (node.nodeType === Node.ELEMENT_NODE) return hasVisibleContent(node as Element);
    return false;
  });
};

const shouldSkipForwardedMessage = (isForwarded: boolean, children: ChildNode[], index: number): boolean => {
  return isForwarded && !hasVisibleContentBefore(children, index);
};

// ---------------------------------------------------------------------------------------------------------------------

export const sanitizeBodyHtml = ({
  bodyHtml,
  gmailAttachments,
  boardId,
  boardCardId,
}: {
  bodyHtml: string;
  gmailAttachments: Attachment[];
  boardId: string;
  boardCardId: string;
}) => {
  const sanitized = DOMPurify.sanitize(bodyHtml, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'head'],
    ADD_ATTR: ['style'],
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/html');
  const sanitizedHtml = doc.body.innerHTML;

  // Replace cid: references with proxy URLs for inline images using DOM
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
  const sanitizedDisplayHtml = doc.body.innerHTML;

  // Get head styles
  const styles = Array.from(doc.head.querySelectorAll('style'))
    .map((style) => style.textContent || '')
    .join('\n');

  return { sanitizedHtml, sanitizedDisplayHtml, styles };
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

  return (
    `On ${dayOfWeek}, ${formattedDate} ` +
    `${from.name || from.email} ` +
    `<<a href="mailto:${from.email}" target="_blank" rel="noopener noreferrer">${from.email}</a>> wrote:`
  );
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
  return `
<div class="gmail_quote">
  <div dir="ltr" class="gmail_attr">${quoteHeader}<br></div>
  <blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${quotedContent}</blockquote>
</div>`;
};

export const removeTrailingEmpty = (container: Element | Document) => {
  const children = Array.from(container.childNodes);
  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node.remove();
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as Element;
      if (!hasVisibleContent(elem)) {
        node.remove();
        continue;
      }
      removeTrailingEmpty(elem); // recursively clean nested containers
    }

    if (node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
      break; // stop when we hit actual content
    }
  }
};

// Recursively collect all blockquote elements and "On ... wrote:" elements
export const parseTrailingBlockquotes = (container: Element): Element[] => {
  const children = Array.from(container.childNodes);
  const quotedElements: Element[] = [];
  let foundFirstQuote = false;

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const elem = node as Element;

    // Check for gmail_quote (direct or nested)
    const gmailQuote = findGmailQuote(elem);
    if (gmailQuote) {
      const gmailAttr = gmailQuote.querySelector('.gmail_attr');
      const isForwarded = !!(gmailAttr && isForwardedHeader(gmailAttr.textContent?.trim() || ''));

      if (shouldSkipForwardedMessage(isForwarded, children, i)) break;

      foundFirstQuote = true;
      quotedElements.push(gmailQuote);
      continue;
    }

    // Check if this element is a quote container (e.g., Gmail quote structure with gmail_attr)
    const quoteIndices = findQuoteContainerChildren(elem);
    if (quoteIndices) {
      const childNodes = Array.from(elem.childNodes).filter(isNonEmptyNode);
      const headerElem = childNodes[quoteIndices.onWroteIndex] as Element;
      const isForwarded = isForwardedHeader(headerElem.textContent?.trim() || '');

      if (shouldSkipForwardedMessage(isForwarded, children, i)) break;

      foundFirstQuote = true;
      quotedElements.push(childNodes[quoteIndices.onWroteIndex] as Element);
      quotedElements.push(childNodes[quoteIndices.blockquoteIndex] as Element);
      continue;
    }

    // Check if this is an "On ... wrote:" or "Forwarded message" element
    const text = elem.textContent?.trim() || '';
    if (isQuoteHeader(text)) {
      if (shouldSkipForwardedMessage(isForwardedHeader(text), children, i)) break;

      foundFirstQuote = true;
      quotedElements.push(elem);

      // Look ahead for a blockquote or element containing a blockquote
      for (let j = i + 1; j < children.length; j++) {
        const nextNode = children[j];
        if (nextNode.nodeType === Node.TEXT_NODE && !nextNode.textContent?.trim()) continue;
        if (nextNode.nodeType !== Node.ELEMENT_NODE) continue;

        const nextElem = nextNode as Element;
        if (nextElem.tagName === 'BLOCKQUOTE' || nextElem.querySelector('blockquote')) {
          quotedElements.push(nextElem);
          i = j;
          break;
        }
        if (nextElem.textContent?.trim()) break;
      }
      continue;
    }

    // If we've found quotes and hit non-quote content, stop collecting
    if (foundFirstQuote && quotedElements.length > 0) break;

    // If no quotes found yet and this element has children, try recursing into it
    if (!foundFirstQuote && elem.children.length > 0) {
      const childQuotes = parseTrailingBlockquotes(elem);
      if (childQuotes.length > 0) {
        quotedElements.push(...childQuotes);
        foundFirstQuote = true;
      }
    }
  }

  return quotedElements;
};

// Parse backquoted text (lines starting with >) from plain text emails
export const parseTrailingBackquotes = (text: string): { mainText: string; backquotesText: string } => {
  const lines = text.split('\n');
  let quoteStartIndex = -1;
  let quoteEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (!trimmedLine) continue;

    const isQuoteLine = isQuoteHeader(trimmedLine) || /^>/.test(trimmedLine);

    if (isQuoteLine) {
      if (quoteStartIndex === -1) quoteStartIndex = i;
      if (/^>/.test(trimmedLine)) quoteEndIndex = i;
    } else if (quoteStartIndex !== -1 && quoteEndIndex !== -1) {
      break;
    }
  }

  if (quoteStartIndex !== -1) {
    const beforeQuote = lines.slice(0, quoteStartIndex).join('\n').trim();
    const isForwardedMessage = isForwardedHeader(lines[quoteStartIndex].trim());

    if (isForwardedMessage && !beforeQuote) {
      return { mainText: text.trimEnd(), backquotesText: '' };
    }

    const endIndex = quoteEndIndex !== -1 ? quoteEndIndex + 1 : lines.length;
    const mainText = `${lines.slice(0, quoteStartIndex).join('\n')}\n${lines.slice(endIndex).join('\n')}`.trim();
    const backquotesText = lines.slice(quoteStartIndex, endIndex).join('\n');
    return { mainText, backquotesText };
  }

  return { mainText: text.trimEnd(), backquotesText: '' };
};
