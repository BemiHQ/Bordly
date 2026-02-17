import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { ChevronDownIcon, Paperclip, Reply } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ToggleQuotesButton } from '@/components/board-card/toggle-quotes-button';
import { Attachment } from '@/components/editor/attachment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEmailIframe } from '@/hooks/use-email-iframe';
import {
  parseTrailingBackquotes,
  parseTrailingBlockquotes,
  removeTrailingEmpty,
  sanitizeBodyHtml,
} from '@/utils/email';
import { pluralize } from '@/utils/strings';
import { formattedShortTime, shortDateTime } from '@/utils/time';
import { API_ENDPOINTS } from '@/utils/urls';

type BoardCardData = inferRouterOutputs<TRPCRouter>['boardCard']['get'];
type EmailMessage = BoardCardData['emailMessagesAsc'][number];
type GmailAttachment = EmailMessage['gmailAttachments'][number];

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
  const [mainHtml, setMainHtml] = useState('');
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
      const { sanitizedDisplayHtml, styles: extractedStyles } = sanitizeBodyHtml({
        bodyHtml: bodyHtml || '',
        gmailAttachments: emailMessage.gmailAttachments,
        boardId,
        boardCardId,
      });

      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${sanitizedDisplayHtml}</body>`, 'text/html');

      // Extract and set trailing blockquotes
      const trailingBlockquotes = parseTrailingBlockquotes(doc.body);
      setBlockquotesHtml(trailingBlockquotes.map((bq) => bq.outerHTML).join(''));
      trailingBlockquotes.forEach((bq) => {
        bq.remove(); // remove from main content
      });

      // Get HTML body
      removeTrailingEmpty(doc.body);
      setMainHtml(doc.body.innerHTML);
      setStyles(extractedStyles);
    } else {
      // Text body
      const { mainText: parsedMainText, backquotesText: parsedBackquotesText } = parseTrailingBackquotes(bodyText);
      setMainText(parsedMainText);
      setBackquotesText(parsedBackquotesText);
    }
  }, [bodyHtml, bodyText, emailMessage.gmailAttachments, boardId, boardCardId]);

  useEmailIframe(bodyIframeRef, { html: mainHtml, styles });
  useEmailIframe(backquotesIframeRef, { html: blockquotesHtml, styles, enabled: blockquotesExpanded });

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

  const handleDownloadAttachment = (attachment: GmailAttachment) => {
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
            <div className="text-xs text-muted-foreground flex-shrink-0">
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
                    <div className="text-xs">{formatParticipant(emailMessage.from)}</div>
                  </div>
                  {emailMessage.to && emailMessage.to.length > 0 && (
                    <div className="flex flex-col">
                      <div className="font-medium text-muted-foreground text-xs">To</div>
                      <div className="text-xs flex flex-col">
                        {emailMessage.to.map((p) => (
                          <div key={p.email}>{formatParticipant(p)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {emailMessage.cc && emailMessage.cc.length > 0 && (
                    <div className="flex flex-col">
                      <div className="font-medium text-muted-foreground text-xs">Cc</div>
                      <div className="text-xs flex flex-col">
                        {emailMessage.cc.map((p) => (
                          <div key={p.email}>{formatParticipant(p)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {emailMessage.bcc && emailMessage.bcc.length > 0 && (
                    <div className="flex flex-col">
                      <div className="font-medium text-muted-foreground text-xs">Bcc</div>
                      <div className="text-xs flex flex-col">
                        {emailMessage.bcc.map((p) => (
                          <div key={p.email}>{formatParticipant(p)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="font-medium text-muted-foreground text-xs">Date</div>
                    <div className="text-xs">{shortDateTime(new Date(emailMessage.externalCreatedAt))}</div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      <EmailMessageBody emailMessage={emailMessage} boardId={boardId} boardCardId={boardCardId} />
      {emailMessage.gmailAttachments.length > 0 && (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
          <div className="flex items-center gap-1.5">
            <Paperclip className="size-4 flex-shrink-0 text-muted-foreground" />
            <div className="text-sm font-medium">
              {emailMessage.gmailAttachments.length} {pluralize('attachment', emailMessage.gmailAttachments.length)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {emailMessage.gmailAttachments
              .sort((a, b) => a.filename.length - b.filename.length)
              .map((attachment) => (
                <Attachment
                  key={attachment.id}
                  filename={attachment.filename}
                  size={attachment.size}
                  onDownload={() => handleDownloadAttachment(attachment)}
                />
              ))}
          </div>
        </div>
      )}
      {onReply && (
        <Button variant="outline" size="sm" onClick={onReply} className="gap-2 self-start mt-2">
          <Reply className="size-4" />
          Reply
        </Button>
      )}
    </Card>
  );
};
