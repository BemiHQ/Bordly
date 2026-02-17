import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import DOMPurify from 'dompurify';
import { ChevronDownIcon, Download, Ellipsis, Paperclip, Reply } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import emailIframeStyles from '@/email-iframe.css?inline';
import { cn, formatBytes, pluralize } from '@/utils/strings';
import { formattedShortTime, shortDateTime } from '@/utils/time';
import { API_ENDPOINTS } from '@/utils/urls';

type EmailMessagesData = inferRouterOutputs<TRPCRouter>['emailMessage']['getEmailMessages'];
type EmailMessage = EmailMessagesData['emailMessagesAsc'][number];
type Attachment = EmailMessage['attachments'][number];

// Remove trailing empty elements like <div><br></div>. This includes nested empty elements within containers
const removeTrailingEmpty = (container: Element | Document) => {
  const children = Array.from(container.childNodes);
  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      node.remove();
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as Element;
      if (!elem.textContent?.trim()) {
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

// Recursively collect all trailing blockquote elements and "On ... wrote:" elements
const parseTrailingBlockquotes = (container: Element): Element[] => {
  const children = Array.from(container.childNodes);
  const trailingElements: Element[] = [];
  let foundQuoteContent = false;

  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue; // Skip empty text nodes

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as Element;

      // Direct blockquote
      if (elem.tagName === 'BLOCKQUOTE') {
        trailingElements.unshift(elem);
        foundQuoteContent = true;
        continue;
      }

      // Check if this is an "On ... wrote:" element
      const text = elem.textContent?.trim() || '';
      if (foundQuoteContent && /^On\s+.+\s+wrote:\s*$/i.test(text)) {
        trailingElements.unshift(elem);
        continue;
      }

      // If element contains nested blockquotes, recurse into it
      if (elem.querySelector('blockquote')) {
        const nestedQuotes = parseTrailingBlockquotes(elem);
        if (nestedQuotes.length > 0) {
          trailingElements.unshift(...nestedQuotes);
          foundQuoteContent = true;
          continue;
        }
      }
    }

    // Stop when we hit actual content
    if (node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
      break;
    }
  }

  return trailingElements;
};

// Parse trailing backquoted text (lines starting with >) from plain text emails
const parseTrailingBackquotes = (text: string): { mainText: string; backquotesText: string } => {
  const lines = text.split('\n');
  let splitIndex = lines.length;
  let foundQuotedLine = false;

  // Scan backwards to find where quoted content starts
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue; // Skip empty lines

    // Check if line is quoted (starts with >)
    if (/^>/.test(trimmedLine)) {
      foundQuotedLine = true;
      splitIndex = i;
      continue;
    }

    // Check if this is an "On ... wrote:" line
    if (foundQuotedLine && /^On\s+.+\s+wrote:\s*$/i.test(trimmedLine)) {
      splitIndex = i;
      continue;
    }

    if (foundQuotedLine) break; // Stop when we hit actual content
  }

  // If we found quoted content, split the text
  if (splitIndex < lines.length) {
    const mainText = lines.slice(0, splitIndex).join('\n').trimEnd();
    const backquotesText = lines.slice(splitIndex).join('\n');
    return { mainText, backquotesText };
  }

  return { mainText: text.trimEnd(), backquotesText: '' };
};

const setIframeContent = (
  iframe: HTMLIFrameElement,
  { styles, body }: { styles: string; body: string },
): ResizeObserver => {
  const iframeDoc = iframe.contentDocument;
  if (!iframeDoc) {
    throw new Error('Unable to access iframe document');
  }

  iframeDoc.documentElement.innerHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>${emailIframeStyles}</style>
    ${styles ? `<style>${styles}</style>` : ''}
  </head>
  <body class="bordly-email">${body}</body>
</html>`;

  const links = iframeDoc.querySelectorAll('a');
  links.forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  const resizeObserver = new ResizeObserver(() => {
    const iframeHtmlScrollHeight = iframeDoc.documentElement.scrollHeight;
    const bodyRectHeight = iframeDoc.body.getBoundingClientRect().height; // Can be float
    const bodyChildrenRectHeight = [...iframeDoc.body.children].reduce(
      (sum, e) => sum + e.getBoundingClientRect().height,
      0,
    ); // Can be float

    const height = Math.max(iframeHtmlScrollHeight, bodyRectHeight, bodyChildrenRectHeight);
    iframe.style.height = `${Math.ceil(height)}px`;
  });
  resizeObserver.observe(iframeDoc.body);

  return resizeObserver;
};

const ToggleQuotesButton = ({ expanded, toggle }: { expanded: boolean; toggle: () => void }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn(
        'self-start mt-4 h-3 px-1.5 text-muted-foreground hover:text-muted-foreground bg-border hover:bg-ring',
        expanded ? 'mb-4' : '',
      )}
    >
      <Ellipsis className="size-4" />
    </Button>
  );
};

const EmailMessageBody = ({
  emailMessage,
  boardId,
  boardCardId,
}: {
  emailMessage: EmailMessage;
  boardId: string;
  boardCardId: string;
}) => {
  const [mainText, setMainText] = useState('');

  const [styles, setStyles] = useState('');
  const [blockquotesExpanded, setBlockquotesExpanded] = useState(false);
  const [blockquotesHtml, setBlockquotesHtml] = useState('');
  const [backquotesText, setBackquotesText] = useState('');
  const bodyIframeRef = useRef<HTMLIFrameElement>(null);
  const backquotesIframeRef = useRef<HTMLIFrameElement>(null);

  const { bodyHtml, bodyText } = emailMessage;

  useEffect(() => {
    if (bodyHtml || !bodyText) {
      // HTML body
      const sanitized = DOMPurify.sanitize(bodyHtml || '', {
        WHOLE_DOCUMENT: true,
        ADD_TAGS: ['style', 'head'],
        ADD_ATTR: ['style'],
      });

      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitized, 'text/html');

      // Replace cid: references with proxy URLs for inline images using DOM
      for (const attachment of emailMessage.attachments) {
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

      // Extract and set trailing blockquotes
      const trailingBlockquotes = parseTrailingBlockquotes(doc.body);
      setBlockquotesHtml(trailingBlockquotes.map((bq) => bq.outerHTML).join(''));
      trailingBlockquotes.forEach((bq) => {
        bq.remove(); // remove from main content
      });

      // Get HTML body
      removeTrailingEmpty(doc.body);
      const mainHtml = doc.body.innerHTML;

      // Get head styles
      const styles = Array.from(doc.head.querySelectorAll('style'))
        .map((style) => style.textContent || '')
        .join('\n');
      setStyles(styles);

      // Insert body into iframe
      if (bodyIframeRef.current) {
        const resizeObserver = setIframeContent(bodyIframeRef.current, { styles, body: mainHtml });
        return () => resizeObserver.disconnect();
      }
    } else {
      // Text body
      const { mainText: parsedMainText, backquotesText: parsedBackquotesText } = parseTrailingBackquotes(bodyText);
      setMainText(parsedMainText);
      setBackquotesText(parsedBackquotesText);
    }
  }, [bodyHtml, bodyText, emailMessage.attachments, boardId, boardCardId]);

  // HTML blockquotes
  useEffect(() => {
    if (!backquotesIframeRef.current || !blockquotesHtml || !blockquotesExpanded) return;
    const resizeObserver = setIframeContent(backquotesIframeRef.current, { styles, body: blockquotesHtml });
    return () => resizeObserver.disconnect();
  }, [blockquotesHtml, blockquotesExpanded, styles]);

  if (emailMessage.bodyHtml) {
    return (
      <div className="flex flex-col">
        <iframe
          ref={bodyIframeRef}
          title="Email content"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="w-full border-0 block overflow-hidden"
        />
        {blockquotesHtml && (
          <>
            <ToggleQuotesButton
              expanded={blockquotesExpanded}
              toggle={() => setBlockquotesExpanded(!blockquotesExpanded)}
            />
            {blockquotesExpanded && (
              <iframe
                ref={backquotesIframeRef}
                title="Email quotes"
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                className="w-full border-0 block overflow-hidden"
              />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="text-sm whitespace-pre-wrap">{mainText}</div>
      {backquotesText && (
        <>
          <ToggleQuotesButton
            expanded={blockquotesExpanded}
            toggle={() => setBlockquotesExpanded(!blockquotesExpanded)}
          />
          {blockquotesExpanded && <div className="text-sm whitespace-pre-wrap">{backquotesText}</div>}
        </>
      )}
    </div>
  );
};

export const EmailMessageCard = ({
  emailMessage,
  boardId,
  boardCardId,
  onReply,
}: {
  emailMessage: EmailMessage;
  boardId: string;
  boardCardId: string;
  onReply?: () => void;
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const participants = [
    emailMessage.from,
    ...(emailMessage.to || []),
    ...(emailMessage.cc || []),
    ...(emailMessage.bcc || []),
  ];

  const firstParticipant = participants[0]!;
  const firstParticipantName = firstParticipant.name || firstParticipant.email;

  let shortAddresses = '';
  if (emailMessage.to && emailMessage.to.length > 0) {
    shortAddresses += `To: ${emailMessage.to.map((p) => p.name || p.email).join(', ')}`;
  }
  if (emailMessage.cc && emailMessage.cc.length > 0) {
    if (shortAddresses.length > 0) shortAddresses += ', ';
    shortAddresses += `Cc: ${emailMessage.cc.map((p) => p.name || p.email).join(', ')}`;
  }
  if (emailMessage.bcc && emailMessage.bcc.length > 0) {
    if (shortAddresses.length > 0) shortAddresses += ', ';
    shortAddresses += `Bcc: ${emailMessage.bcc.map((p) => p.name || p.email).join(', ')}`;
  }

  const formatParticipant = (p: { name: string | null; email: string }) => {
    if (p.name && p.name !== p.email) {
      return `${p.name} <${p.email}>`;
    }
    return p.email;
  };

  const { iconUrl } = emailMessage.domain;

  const handleDownloadAttachment = (attachment: Attachment) => {
    const url = `${API_ENDPOINTS.PROXY_GMAIL_ATTACHMENT}?boardId=${boardId}&boardCardId=${boardCardId}&attachmentId=${attachment.id}`;
    window.open(url, '_blank');
  };

  return (
    <Card className="p-4 pt-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage
            src={
              iconUrl && !iconUrl.startsWith('/')
                ? `${API_ENDPOINTS.PROXY_ICON}?url=${encodeURIComponent(iconUrl!)}`
                : iconUrl
            }
            alt={firstParticipantName}
          />
          <AvatarFallback hashForBgColor={firstParticipantName}>
            {firstParticipantName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col w-full min-w-0">
          <div className="flex justify-between gap-2">
            {firstParticipantName === firstParticipant.email ? (
              <div className="text-sm font-medium">{firstParticipantName}</div>
            ) : (
              <div className="flex flex-row items-center gap-1.5">
                <div className="text-sm font-medium">{firstParticipantName}</div>
                <div className="text-xs text-muted-foreground">{`<${firstParticipant.email}>`}</div>
              </div>
            )}
            <div className="text-2xs text-muted-foreground flex-shrink-0">
              {formattedShortTime(new Date(emailMessage.externalCreatedAt))}
            </div>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <div className="text-xs text-muted-foreground truncate">{shortAddresses}</div>
            <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-4.5 flex-shrink-0 rounded-full">
                  <ChevronDownIcon className="size-4 text-muted-foreground pt-[2px]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-96">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col">
                    <div className="font-medium text-muted-foreground text-xs">From</div>
                    <div className="text-sm">{formatParticipant(emailMessage.from)}</div>
                  </div>
                  {emailMessage.to && emailMessage.to.length > 0 && (
                    <div className="flex flex-col">
                      <div className="font-medium text-muted-foreground text-xs">To</div>
                      <div className="text-sm flex flex-col">
                        {emailMessage.to.map((p) => (
                          <div key={p.email}>{formatParticipant(p)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {emailMessage.cc && emailMessage.cc.length > 0 && (
                    <div className="flex flex-col">
                      <div className="font-medium text-muted-foreground text-xs">Cc</div>
                      <div className="text-sm flex flex-col">
                        {emailMessage.cc.map((p) => (
                          <div key={p.email}>{formatParticipant(p)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {emailMessage.bcc && emailMessage.bcc.length > 0 && (
                    <div className="flex flex-col">
                      <div className="font-medium text-muted-foreground text-xs">Bcc</div>
                      <div className="text-sm flex flex-col">
                        {emailMessage.bcc.map((p) => (
                          <div key={p.email}>{formatParticipant(p)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="font-medium text-muted-foreground text-xs">Date</div>
                    <div className="text-sm">{shortDateTime(new Date(emailMessage.externalCreatedAt))}</div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      <EmailMessageBody emailMessage={emailMessage} boardId={boardId} boardCardId={boardCardId} />
      {onReply && (
        <Button variant="outline" size="sm" onClick={onReply} className="gap-2 self-start mt-2">
          <Reply className="size-4" />
          Reply
        </Button>
      )}
      {emailMessage.attachments.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5 pt-5 border-t">
          <div className="flex items-center gap-1.5">
            <Paperclip className="size-4 flex-shrink-0 text-muted-foreground" />
            <div className="text-sm font-medium">
              {emailMessage.attachments.length} {pluralize('attachment', emailMessage.attachments.length)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {emailMessage.attachments
              .sort((a, b) => a.filename.length - b.filename.length)
              .map((attachment) => (
                <button
                  key={attachment.id}
                  onClick={() => handleDownloadAttachment(attachment)}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-muted rounded-lg text-xs w-fit cursor-pointer"
                  type="button"
                >
                  <Download className="size-3.5 flex-shrink-0 text-muted-foreground mb-0.5" />
                  <div className="flex items-end gap-1.5">
                    <div className="truncate text-text-secondary font-medium">{attachment.filename}</div>
                    <div className="text-muted-foreground text-2xs">({formatBytes(attachment.size)})</div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
};
