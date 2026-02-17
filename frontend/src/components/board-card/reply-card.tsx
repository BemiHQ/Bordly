import { useMutation, useQuery } from '@tanstack/react-query';
import { useEditor } from '@tiptap/react';
import { ALargeSmall, Paperclip, Send, Trash } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { ToggleQuotesButton } from '@/components/board-card/toggle-quotes-button';
import { Attachment, UploadingAttachment } from '@/components/editor/attachment';
import { Editor, editorConfig } from '@/components/editor/editor';
import { MenuBar } from '@/components/editor/menu-bar';
import { Participants, participantToInput } from '@/components/editor/participants';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEmailIframe } from '@/hooks/use-email-iframe';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { useRouteContext } from '@/hooks/use-route-context';
import {
  addEmailMessageData,
  addFileAttachmentToEmailDraftData,
  type BoardCardData,
  type EmailDraft,
  type EmailMessage,
  type FileAttachment,
  type Participant,
  removeEmailDraftData,
  removeFileAttachmentFromEmailDraftData,
  replaceBoardCardData,
} from '@/query-helpers/board-card';
import {
  removeBoardCardEmailDraftData,
  replaceBoardCardData as replaceBoardCardDataInList,
  setBoardCardEmailDraftData,
} from '@/query-helpers/board-cards';
import { createQuotedHtml, formatQuoteHeader, sanitizeBodyHtml } from '@/utils/email';
import { reportError } from '@/utils/error-tracking';
import { cn } from '@/utils/strings';
import { API_ENDPOINTS } from '@/utils/urls';

const AUTO_SAVE_INTERVAL_MS = 1_000;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const participantsToInput = (participants?: Participant[]) =>
  participants?.map((participant) => participantToInput(participant)).join(', ') ?? '';

const parseParticipantsInput = (value: string) => {
  const participantStrings = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  return participantStrings.length > 0 ? participantStrings : undefined;
};

export const ReplyCard = ({
  boardId,
  boardCardId,
  emailDraft,
  emailMessagesAsc,
  onDiscard,
}: {
  boardId: string;
  boardCardId: string;
  emailDraft?: EmailDraft;
  emailMessagesAsc: EmailMessage[];
  onDiscard: () => void;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const [from, setFrom] = useState(emailDraft ? participantToInput(emailDraft.from) : '');
  const [to, setTo] = useState(emailDraft ? participantsToInput(emailDraft.to) : '');
  const [cc, setCc] = useState(emailDraft ? participantsToInput(emailDraft.cc) : '');
  const [bcc, setBcc] = useState(emailDraft ? participantsToInput(emailDraft.bcc) : '');

  // Set default "From" address using loaded email addresses
  const { data: emailAddressesData } = useQuery({ ...trpc.emailAddress.getEmailAddresses.queryOptions({ boardId }) });
  const lastEmailMessage = emailMessagesAsc[emailMessagesAsc.length - 1];
  const fromEmailAddresses = emailAddressesData?.emailAddresses || [];
  useEffect(() => {
    if (emailDraft || fromEmailAddresses.length === 0) return;

    const lastEmailParticipantEmails = new Set<string>([
      lastEmailMessage?.from.email,
      ...(lastEmailMessage?.to?.map((p) => p.email) ?? []),
      ...(lastEmailMessage?.cc?.map((p) => p.email) ?? []),
      ...(lastEmailMessage?.bcc?.map((p) => p.email) ?? []),
    ]);
    const fromEmailAddress =
      fromEmailAddresses.find((addr) => lastEmailParticipantEmails.has(addr.email)) ||
      fromEmailAddresses.find((addr) => addr.isDefault) ||
      fromEmailAddresses[0];
    setFrom(participantToInput(fromEmailAddress));

    if (lastEmailMessage) {
      setTo(
        lastEmailMessage!.from.email === fromEmailAddress.email
          ? participantsToInput(lastEmailMessage.to)
          : participantToInput(lastEmailMessage.from),
      );
      setCc(participantsToInput(lastEmailMessage.cc));
    }
  }, [emailDraft, lastEmailMessage, fromEmailAddresses]);

  const [hasChanges, setHasChanges] = useState(!emailDraft);
  const autosaveIntervalRef = useRef<number | null>(null);
  const [blockquotesExpanded, setBlockquotesExpanded] = useState(false);
  const blockquotesIframeRef = useRef<HTMLIFrameElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>(emailDraft?.fileAttachments || []);
  const [menuBarVisible, setMenuBarVisible] = useState(false);

  const emailDraftUpsertMutation = useMutation(
    trpc.emailDraft.upsert.mutationOptions({
      onSuccess: ({ boardCard }) => {
        replaceBoardCardData({ trpc, queryClient, params: { boardId, boardCard } });
        replaceBoardCardDataInList({ trpc, queryClient, params: { boardId, boardCard } });
      },
    }),
  );

  const boardCardQueryKey = trpc.boardCard.get.queryKey({ boardId, boardCardId });
  const upsertDraftMutation = useMutation(trpc.emailDraft.upsert.mutationOptions());
  const optimisticallyDiscardDraft = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: (params) => {
      removeEmailDraftData({ trpc, queryClient, params });
      removeBoardCardEmailDraftData({ trpc, queryClient, params });
    },
    successToast: 'Draft discarded',
    errorToast: 'Failed to discard draft',
    mutation: useMutation(trpc.emailDraft.delete.mutationOptions()),
    undoMutationConfig: ({ boardId, boardCardId }, beforeMutationData) => {
      const previousEmailDraft = (beforeMutationData as BoardCardData).boardCard.emailDraft!;
      setBoardCardEmailDraftData({
        trpc,
        queryClient,
        params: { boardId, boardCardId, emailDraft: previousEmailDraft },
      });
      return {
        mutation: upsertDraftMutation,
        params: {
          boardId,
          boardCardId,
          subject: previousEmailDraft.subject || '',
          bodyHtml: previousEmailDraft.bodyHtml || '',
          from: previousEmailDraft.from ? participantToInput(previousEmailDraft.from) : '',
          to: previousEmailDraft.to ? previousEmailDraft.to.map((p) => participantToInput(p)) : undefined,
          cc: previousEmailDraft.cc ? previousEmailDraft.cc.map((p) => participantToInput(p)) : undefined,
          bcc: previousEmailDraft.bcc ? previousEmailDraft.bcc.map((p) => participantToInput(p)) : undefined,
        },
      };
    },
  });

  const emailDraftSendMutation = useMutation(
    trpc.emailDraft.send.mutationOptions({
      onSuccess: ({ emailMessage, boardCard }) => {
        addEmailMessageData({ trpc, queryClient, params: { boardId, boardCardId, emailMessage } });
        replaceBoardCardDataInList({ trpc, queryClient, params: { boardId, boardCard } });
        editor.commands.clearContent();
        onDiscard();
      },
    }),
  );

  const quotedHtml = lastEmailMessage
    ? createQuotedHtml({
        bodyHtml: lastEmailMessage.bodyHtml || '',
        bodyText: lastEmailMessage.bodyText,
        quoteHeader: formatQuoteHeader({ from: lastEmailMessage.from, sentAt: lastEmailMessage.externalCreatedAt }),
      })
    : '';

  const { sanitizedHtml: sanitizedQuotedHtml, sanitizedDisplayHtml: sanitizedDisplayQuotedHtml } = useMemo(() => {
    if (!quotedHtml || !lastEmailMessage) return { sanitizedHtml: '', sanitizedDisplayHtml: '' };
    return sanitizeBodyHtml({
      bodyHtml: quotedHtml,
      gmailAttachments: lastEmailMessage.gmailAttachments,
      boardId,
      boardCardId,
    });
  }, [quotedHtml, lastEmailMessage, boardId, boardCardId]);

  useEmailIframe(blockquotesIframeRef, {
    html: sanitizedDisplayQuotedHtml,
    enabled: blockquotesExpanded,
  });

  const editor = useEditor(editorConfig({ initialHtml: emailDraft?.bodyHtml?.split(sanitizedQuotedHtml)[0] }));

  // biome-ignore lint/correctness/useExhaustiveDependencies: ignore emailDraftUpsertMutation to avoid unnecessary re-renders
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!editor || !lastEmailMessage || emailDraftUpsertMutation.isPending || !hasChanges) return;

      emailDraftUpsertMutation.mutate({
        boardId,
        boardCardId,
        subject: lastEmailMessage.subject.includes('Re:')
          ? lastEmailMessage.subject
          : `Re: ${lastEmailMessage.subject}`,
        bodyHtml: `${editor.getHTML()}${sanitizedQuotedHtml}`,
        from: from.trim(),
        to: to ? parseParticipantsInput(to) : undefined,
        cc: cc ? parseParticipantsInput(cc) : undefined,
        bcc: bcc ? parseParticipantsInput(bcc) : undefined,
      });
      setHasChanges(false);
    }, AUTO_SAVE_INTERVAL_MS);
    autosaveIntervalRef.current = intervalId;
    return () => {
      window.clearInterval(intervalId);
      autosaveIntervalRef.current = null;
    };
  }, [
    editor,
    lastEmailMessage,
    emailDraftUpsertMutation.isPending,
    hasChanges,
    boardCardId,
    boardId,
    from,
    to,
    cc,
    bcc,
    quotedHtml,
  ]);

  const handleSend = () => {
    if (!editor || !lastEmailMessage) return;

    // Cancel autosave to avoid race conditions
    if (autosaveIntervalRef.current !== null) {
      window.clearInterval(autosaveIntervalRef.current);
      autosaveIntervalRef.current = null;
    }
    setHasChanges(false);

    emailDraftSendMutation.mutate({
      boardId,
      boardCardId,
      subject: lastEmailMessage.subject.includes('Re:') ? lastEmailMessage.subject : `Re: ${lastEmailMessage.subject}`,
      bodyHtml: `${editor.getHTML()}${sanitizedQuotedHtml}`,
      from: from.trim(),
      to: to ? parseParticipantsInput(to) : undefined,
      cc: cc ? parseParticipantsInput(cc) : undefined,
      bcc: bcc ? parseParticipantsInput(bcc) : undefined,
    });
  };

  const handleDiscard = () => {
    if (emailDraft) {
      optimisticallyDiscardDraft({ boardId, boardCardId });
    }
    onDiscard();
  };

  const uploadAttachment = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File "${file.name}" exceeds the 25MB size limit`, { position: 'top-center' });
      return;
    }

    if (attachments.some((a) => a.filename === file.name) || uploadingFiles.includes(file.name)) {
      toast.error(`File "${file.name}" is already attached`, { position: 'top-center' });
      return;
    }

    setUploadingFiles((prev) => [...prev, file.name]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${API_ENDPOINTS.FILE_ATTACHMENT_UPLOAD}?boardId=${encodeURIComponent(boardId)}&boardCardId=${encodeURIComponent(boardCardId)}`,
        { method: 'POST', body: formData, credentials: 'include' },
      );
      if (!response.ok) throw new Error('Upload failed');

      const { fileAttachment } = (await response.json()) as { fileAttachment: FileAttachment };
      setAttachments((prev) => [...prev, fileAttachment]);
      addFileAttachmentToEmailDraftData({ trpc, queryClient, params: { boardId, boardCardId, fileAttachment } });
    } catch (error) {
      reportError(error, { fileName: file.name, boardId, boardCardId });
      toast.error(`Failed to upload "${file.name}"`, { position: 'top-center' });
    } finally {
      setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
    }
  };

  const deleteAttachment = async (fileAttachmentId: string) => {
    try {
      const response = await fetch(
        `${API_ENDPOINTS.FILE_ATTACHMENT_DELETE}?boardId=${encodeURIComponent(boardId)}&boardCardId=${encodeURIComponent(boardCardId)}&fileAttachmentId=${encodeURIComponent(fileAttachmentId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!response.ok) throw new Error('Delete failed');

      setAttachments((prev) => prev.filter((a) => a.id !== fileAttachmentId));
      removeFileAttachmentFromEmailDraftData({ trpc, queryClient, params: { boardId, boardCardId, fileAttachmentId } });
    } catch (error) {
      console.error('Failed to delete attachment:', error);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      for (const file of acceptedFiles) {
        uploadAttachment(file);
      }
    },
    noClick: true,
    noKeyboard: true,
  });

  return (
    <Card className={cn('p-0 flex flex-col gap-0', isDragActive && 'relative')} {...getRootProps()}>
      {isDragActive && (
        <div className="absolute inset-0 rounded-xl bg-card p-4 flex items-center justify-center z-10">
          <div className="border-1 border-dashed border-muted-foreground rounded-lg w-full h-full flex items-center justify-center">
            <div className="font-medium text-muted-foreground">Drop files here to attach</div>
          </div>
        </div>
      )}
      {from && (
        <Participants
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
          cc={cc}
          setCc={setCc}
          bcc={bcc}
          setBcc={setBcc}
          fromEmailAddresses={fromEmailAddresses}
          onChange={() => setHasChanges(true)}
        />
      )}
      <Editor editor={editor} onChange={() => setHasChanges(true)} />
      {sanitizedDisplayQuotedHtml && (
        <div className="flex flex-col px-4">
          <ToggleQuotesButton
            expanded={blockquotesExpanded}
            toggle={() => setBlockquotesExpanded(!blockquotesExpanded)}
          />
          {blockquotesExpanded && (
            <iframe
              ref={blockquotesIframeRef}
              title="Quoted message"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="w-full border-0 block overflow-hidden mb-4"
            />
          )}
        </div>
      )}
      {(attachments.length > 0 || uploadingFiles.length > 0) && (
        <div className="flex flex-col gap-2 px-4 pt-4">
          {attachments.map((attachment) => (
            <Attachment
              key={attachment.id}
              filename={attachment.filename}
              size={attachment.size}
              onDelete={() => deleteAttachment(attachment.id)}
            />
          ))}
          {uploadingFiles.map((filename) => (
            <UploadingAttachment key={filename} filename={filename} />
          ))}
        </div>
      )}
      {menuBarVisible && <MenuBar editor={editor} />}
      <div className="flex justify-between items-center gap-2.5 px-4 mt-4 pb-3">
        <input {...getInputProps()} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSend} disabled={emailDraftSendMutation.isPending}>
            {emailDraftSendMutation.isPending ? (
              <>
                <Spinner className="h-4 w-4" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send
              </>
            )}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={menuBarVisible ? 'bg-muted' : 'text-muted-foreground'}
                onClick={() => setMenuBarVisible(!menuBarVisible)}
              >
                <ALargeSmall className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle formatting</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.preventDefault();
                  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                  input?.click();
                }}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach files</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-primary"
                size="icon-sm"
                onClick={handleDiscard}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{emailDraft ? 'Discard' : 'Cancel'}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
};
