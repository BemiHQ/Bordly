import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import DOMPurify from 'dompurify';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
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
      {emailMessage.bodyHtml ? (
        <div
          className="text-sm email-body"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Using DOMPurify to sanitize HTML content
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailMessage.bodyHtml) }}
        />
      ) : (
        <div className="text-sm whitespace-pre-wrap">{emailMessage.bodyText}</div>
      )}
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
        <DialogContent className="min-w-5xl h-[90vh] flex flex-col bg-secondary px-0 pb-0">
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
