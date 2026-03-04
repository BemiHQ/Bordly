import { ChevronDownIcon, Paperclip, Reply, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ToggleQuotesButton } from '@/components/board-card/toggle-quotes-button';
import { Attachment } from '@/components/editor/attachment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEmailIframe } from '@/hooks/use-email-iframe';
import type { BoardMember } from '@/query-helpers/board';
import type { EmailMessage } from '@/query-helpers/board-card';
import { sanitizedDisplayHtml } from '@/utils/email';
import { cn, pluralize } from '@/utils/strings';
import { formattedShortTime, shortDateTime } from '@/utils/time';
import { API_ENDPOINTS } from '@/utils/urls';

const EmailMessageBody = ({
  emailMessage,
  boardId,
  boardCardId,
  setBlockedTrackerDomains,
  setInlineImageAttachmentIds,
}: {
  emailMessage: EmailMessage;
  boardId: string;
  boardCardId: string;
  setBlockedTrackerDomains: (blockedTrackerDomains: string[]) => void;
  setInlineImageAttachmentIds: (inlineImageAttachmentIds: string[]) => void;
}) => {
  const [displayMainHtml, setDisplayMainHtml] = useState('');
  const [blockquotesExpanded, setBlockquotesExpanded] = useState(false);
  const [displayQuotedHtml, setDisplayQuotedHtml] = useState('');
  const bodyIframeRef = useRef<HTMLIFrameElement>(null);
  const backquotesIframeRef = useRef<HTMLIFrameElement>(null);

  const { mainHtml, mainText, quotedHtml, quotedText, styles } = emailMessage;

  // biome-ignore lint/correctness/useExhaustiveDependencies: ignore mutation to avoid re-running
  useEffect(() => {
    if (mainHtml || quotedHtml) {
      const mainResult = sanitizedDisplayHtml({
        html: mainHtml || '',
        gmailAttachments: emailMessage.gmailAttachments,
        boardId,
        boardCardId,
      });

      const quotedResult = sanitizedDisplayHtml({
        html: quotedHtml || '',
        gmailAttachments: emailMessage.gmailAttachments,
        boardId,
        boardCardId,
      });

      setDisplayMainHtml(mainResult.displayHtml);
      setDisplayQuotedHtml(quotedResult.displayHtml);

      const allBlockedTrackers = [...mainResult.blockedTrackerDomains, ...quotedResult.blockedTrackerDomains];
      setBlockedTrackerDomains(allBlockedTrackers);

      const allInlineImageAttachmentIds = [
        ...mainResult.inlineImageAttachmentIds,
        ...quotedResult.inlineImageAttachmentIds,
      ];
      setInlineImageAttachmentIds(allInlineImageAttachmentIds);
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
  isLast = true,
}: {
  emailMessage: EmailMessage;
  boardId: string;
  boardCardId: string;
  boardMembers: BoardMember[];
  onReply: (emailMessage: EmailMessage) => void;
  isLast: boolean;
}) => {
  const [blockedTrackerDomains, setBlockedTrackerDomains] = useState<string[]>([]);
  const [inlineImageAttachmentIds, setInlineImageAttachmentIds] = useState<string[]>([]);

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

  const nonInlineAttachments = emailMessage.gmailAttachments.filter(
    (attachment) => !inlineImageAttachmentIds.includes(attachment.id),
  );

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
          <div className="flex justify-between items-start gap-2">
            <div className="flex flex-col">
              {firstParticipantName === firstParticipant.email ? (
                <div className="text-sm font-medium">{firstParticipantName}</div>
              ) : (
                <div className="flex flex-row items-center gap-1.5">
                  <div className="text-sm font-medium">{firstParticipantName}</div>
                  <div className="text-xs text-muted-foreground">{`<${firstParticipant.email}>`}</div>
                </div>
              )}
              <div className="flex items-center gap-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate">{shortAddresses || 'To'}</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-4.5 flex-shrink-0 rounded-full">
                      <ChevronDownIcon className="size-4 text-muted-foreground pt-[2px]" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="w-fit">
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
            <div className="flex gap-3">
              {blockedTrackerDomains.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="focus:outline-none mt-[5px]">
                      <Badge
                        variant="outline"
                        size="sm"
                        className="gap-1 cursor-pointer hover:bg-accent text-muted-foreground pr-2"
                      >
                        <ShieldAlert className="size-3" />
                        {blockedTrackerDomains.length} blocked
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-fit">
                    <div className="flex flex-col gap-2">
                      <div className="font-medium text-muted-foreground text-xs">Blocked trackers</div>
                      <ul className="list-disc list-inside text-xs">
                        {blockedTrackerDomains.map((tracker) => (
                          <li key={tracker}>{tracker}</li>
                        ))}
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <div className={cn('text-xs text-muted-foreground mt-2', isLast && 'mr-2.5')}>
                {formattedShortTime(new Date(emailMessage.externalCreatedAt))}
              </div>
              {!isLast && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" onClick={() => onReply(emailMessage)}>
                      <Reply className="text-muted-foreground size-4.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reply</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
      <EmailMessageBody
        emailMessage={emailMessage}
        boardId={boardId}
        boardCardId={boardCardId}
        setBlockedTrackerDomains={setBlockedTrackerDomains}
        setInlineImageAttachmentIds={setInlineImageAttachmentIds}
      />
      {nonInlineAttachments.length > 0 && (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
          <div className="flex items-center gap-1.5">
            <Paperclip className="size-4 flex-shrink-0 text-muted-foreground" />
            <div className="text-sm font-medium">
              {nonInlineAttachments.length} {pluralize('attachment', nonInlineAttachments.length)}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {nonInlineAttachments
              .sort((a, b) => a.filename.length - b.filename.length)
              .map((attachment) => (
                <a
                  key={attachment.id}
                  href={`${API_ENDPOINTS.PROXY_GMAIL_ATTACHMENT}?boardId=${boardId}&boardCardId=${boardCardId}&gmailAttachmentId=${attachment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Attachment key={attachment.id} filename={attachment.filename} size={attachment.size} />
                </a>
              ))}
          </div>
        </div>
      )}
      {isLast && (
        <Button variant="outline" size="sm" onClick={() => onReply(emailMessage)} className="gap-2 self-start mt-2">
          <Reply className="size-4" />
          Reply
        </Button>
      )}
    </Card>
  );
};
