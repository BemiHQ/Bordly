import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import DOMPurify from 'dompurify';
import { ChevronDownIcon, Ellipsis } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import emailIframeStyles from '@/email-iframe.css?inline';
import { RouteProvider } from '@/hooks/use-route-context';
import { extractUuid } from '@/utils/strings';
import { formattedShortTime, shortDateTime } from '@/utils/time';
import { ROUTES } from '@/utils/urls';

type EmailMessagesData = inferRouterOutputs<TRPCRouter>['emailMessage']['getEmailMessages'];
type EmailMessage = EmailMessagesData['emailMessages'][number];

export const Route = createFileRoute('/boards/$boardId/c/$boardCardId')({
  component: BoardCardComponent,
  beforeLoad: async ({ context: { queryClient, trpc } }) => {
    const { currentUser, boards } = await queryClient.ensureQueryData(trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }
  },
});

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

  return { mainText: text, backquotesText: '' };
};

const setIframeContent = (
  iframe: HTMLIFrameElement,
  { styles, body }: { styles: string; body: string },
): ResizeObserver => {
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
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
    iframe.style.height = `${iframeDoc.documentElement.scrollHeight}px`;
  });
  resizeObserver.observe(iframeDoc.body);

  return resizeObserver;
};

const ToggleQuotesButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="self-start my-2 h-3 px-1.5 text-muted-foreground hover:text-muted-foreground bg-border hover:bg-ring"
    >
      <Ellipsis className="size-4" />
    </Button>
  );
};

const EmailMessageBody = ({ emailMessage }: { emailMessage: EmailMessage }) => {
  const [cleanedHtml, setCleanedHtml] = useState('');
  const [emailStyles, setEmailStyles] = useState('');
  const [trailingBlockquotesHtml, setTrailingBlockquotesHtml] = useState('');
  const [blockquotesExpanded, setBlockquotesExpanded] = useState(false);
  const [mainText, setMainText] = useState('');
  const [backquotesText, setBackquotesText] = useState('');
  const bodyIframeRef = useRef<HTMLIFrameElement>(null);
  const backquotesIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!emailMessage.bodyHtml) return;

    const sanitized = DOMPurify.sanitize(emailMessage.bodyHtml, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['style', 'head'],
      ADD_ATTR: ['style'],
    });
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, 'text/html');

    // Extract trailing blockquotes
    const trailingBlockquotes = parseTrailingBlockquotes(doc.body);
    if (trailingBlockquotes.length > 0) {
      const quotesArray = trailingBlockquotes.map((bq) => bq.outerHTML);
      setTrailingBlockquotesHtml(quotesArray.join(''));
      trailingBlockquotes.forEach((bq) => {
        bq.remove(); // remove from main content
      });
    }

    // Set cleaned inner HTML
    removeTrailingEmpty(doc.body);
    setCleanedHtml(doc.body.innerHTML);

    // Extract styles
    const styles = Array.from(doc.head.querySelectorAll('style'))
      .map((style) => style.textContent || '')
      .join('\n');
    setEmailStyles(styles);
  }, [emailMessage.bodyHtml]);

  useEffect(() => {
    if (!bodyIframeRef.current || !cleanedHtml) return;

    const resizeObserver = setIframeContent(bodyIframeRef.current, {
      styles: emailStyles,
      body: cleanedHtml,
    });

    return () => resizeObserver.disconnect();
  }, [cleanedHtml, emailStyles]);

  useEffect(() => {
    if (!backquotesIframeRef.current || !trailingBlockquotesHtml || !blockquotesExpanded) return;

    const resizeObserver = setIframeContent(backquotesIframeRef.current, {
      styles: emailStyles,
      body: trailingBlockquotesHtml,
    });

    return () => resizeObserver.disconnect();
  }, [trailingBlockquotesHtml, blockquotesExpanded, emailStyles]);

  useEffect(() => {
    if (!emailMessage.bodyText || emailMessage.bodyHtml) return;

    const { mainText: parsedMainText, backquotesText: parsedBackquotesText } = parseTrailingBackquotes(
      emailMessage.bodyText,
    );
    setMainText(parsedMainText);
    setBackquotesText(parsedBackquotesText);
  }, [emailMessage.bodyText, emailMessage.bodyHtml]);

  if (emailMessage.bodyHtml) {
    return (
      <div className="flex flex-col">
        <iframe
          ref={bodyIframeRef}
          title="Email content"
          sandbox="allow-same-origin"
          className="w-full border-0 block"
        />
        {trailingBlockquotesHtml && (
          <>
            <ToggleQuotesButton onClick={() => setBlockquotesExpanded(!blockquotesExpanded)} />
            {blockquotesExpanded && (
              <iframe
                ref={backquotesIframeRef}
                title="Email quotes"
                sandbox="allow-same-origin"
                className="w-full border-0 block"
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
          <ToggleQuotesButton onClick={() => setBlockquotesExpanded(!blockquotesExpanded)} />
          {blockquotesExpanded && <div className="text-sm whitespace-pre-wrap">{backquotesText}</div>}
        </>
      )}
    </div>
  );
};

const EmailMessageCard = ({ emailMessage }: { emailMessage: EmailMessage }) => {
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

  return (
    <Card className="p-4 pt-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={emailMessage.domain.iconUrl} alt={firstParticipantName} />
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
      <EmailMessageBody emailMessage={emailMessage} />
    </Card>
  );
};

function BoardCardComponent() {
  const context = Route.useRouteContext();
  const params = Route.useParams();
  const navigate = useNavigate();

  const boardId = extractUuid(params.boardId);
  const boardCardId = extractUuid(params.boardCardId);

  const { data: emailMessagesData, isLoading } = useQuery({
    ...context.trpc.emailMessage.getEmailMessages.queryOptions({ boardId, boardCardId }),
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) navigate({ to: ROUTES.BOARD.replace('$boardId', params.boardId) });
  };

  return (
    <RouteProvider value={context}>
      <Dialog open={true} onOpenChange={handleOpenChange}>
        <DialogContent className="min-w-5xl h-[90vh] flex flex-col bg-secondary px-0 pb-0" aria-describedby={undefined}>
          <DialogHeader className="px-6">
            <DialogTitle>{emailMessagesData?.boardCard.subject}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            )}
            {emailMessagesData && (
              <div className="flex flex-col gap-3 px-6 pb-6">
                {emailMessagesData.emailMessages.map((emailMessage) => (
                  <EmailMessageCard key={emailMessage.id} emailMessage={emailMessage} />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </RouteProvider>
  );
}
