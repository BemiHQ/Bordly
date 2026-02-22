import { ChevronDownIcon, Paperclip, Reply } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ToggleQuotesButton } from '@/components/board-card/toggle-quotes-button';
import { Attachment } from '@/components/editor/attachment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEmailIframe } from '@/hooks/use-email-iframe';
import type { BoardMember } from '@/query-helpers/board';
import type { EmailMessage, GmailAttachment } from '@/query-helpers/board-card';
import { sanitizedDisplayHtml } from '@/utils/email';
import { pluralize } from '@/utils/strings';
import { formattedShortTime, shortDateTime } from '@/utils/time';
import { API_ENDPOINTS } from '@/utils/urls';

const EmailMessageBody = ({
  emailMessage,
  boardId,
  boardCardId,
}: {
  emailMessage: EmailMessage;
  boardId: string;
  boardCardId: string;
}) => {
  const [displayMainHtml, setDisplayMainHtml] = useState('');
  const [blockquotesExpanded, setBlockquotesExpanded] = useState(false);
  const [displayQuotedHtml, setDisplayQuotedHtml] = useState('');
  const bodyIframeRef = useRef<HTMLIFrameElement>(null);
  const backquotesIframeRef = useRef<HTMLIFrameElement>(null);

  const { mainHtml, mainText, quotedHtml, quotedText, styles } = emailMessage;

  useEffect(() => {
    if (mainHtml || quotedHtml) {
      const displayMain = sanitizedDisplayHtml({
        bodyHtml: mainHtml || '',
        gmailAttachments: emailMessage.gmailAttachments,
        boardId,
        boardCardId,
      });

      const displayQuoted = sanitizedDisplayHtml({
        bodyHtml: quotedHtml || '',
        gmailAttachments: emailMessage.gmailAttachments,
        boardId,
        boardCardId,
      });

      setDisplayMainHtml(displayMain);
      setDisplayQuotedHtml(displayQuoted);
    }
  }, [mainHtml, quotedHtml, emailMessage.gmailAttachments, boardId, boardCardId]);

  useEmailIframe(bodyIframeRef, { html: displayMainHtml, styles: styles ?? '' });
  useEmailIframe(backquotesIframeRef, { html: displayQuotedHtml, styles: styles ?? '', enabled: blockquotesExpanded });

  if (displayMainHtml || displayQuotedHtml) {
    return (
      <div className="flex flex-col">
        {displayMainHtml && (
          <iframe
            ref={bodyIframeRef}
            title="Email content"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="w-full border-0 block overflow-hidden"
          />
        )}
        {displayQuotedHtml && (
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

  if (!mainText && !quotedText) return null;

  return (
    <div className="flex flex-col">
      <div className="text-sm whitespace-pre-wrap">{mainText}</div>
      {quotedText && (
        <>
          <ToggleQuotesButton
            expanded={blockquotesExpanded}
            toggle={() => setBlockquotesExpanded(!blockquotesExpanded)}
          />
          {blockquotesExpanded && <div className="text-sm whitespace-pre-wrap">{quotedText}</div>}
        </>
      )}
    </div>
  );
};

export const EmailMessageCard = ({
  emailMessage,
  boardId,
  boardCardId,
  boardMembers,
  onReply,
}: {
  emailMessage: EmailMessage;
  boardId: string;
  boardCardId: string;
  boardMembers: BoardMember[];
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
  const firstParticipantMember = boardMembers.find((m) => m.senderEmails.includes(firstParticipant.email));

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
    const url = `${API_ENDPOINTS.PROXY_GMAIL_ATTACHMENT}?boardId=${boardId}&boardCardId=${boardCardId}&gmailAttachmentId=${attachment.id}`;
    window.open(url, '_blank');
  };

  return (
    <Card className="p-4 pt-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage
            src={
              firstParticipantMember
                ? firstParticipantMember.user.photoUrl
                : iconUrl && !iconUrl.startsWith('/')
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
            <div className="text-xs text-muted-foreground truncate">{shortAddresses || 'To'}</div>
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
                  {emailMessage.replyTo && (
                    <div className="flex flex-col">
                      <div className="font-medium text-muted-foreground text-xs">Reply to</div>
                      <div className="text-xs">{formatParticipant(emailMessage.replyTo)}</div>
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
