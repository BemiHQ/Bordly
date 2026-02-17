import { useMutation, useQuery } from '@tanstack/react-query';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ToggleQuotesButton } from '@/components/board-card/toggle-quotes-button';
import {
  COLORS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZES,
  MenuBar,
} from '@/components/editor/menu-bar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useEmailIframe } from '@/hooks/use-email-iframe';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { useRouteContext } from '@/hooks/use-route-context';
import { createQuotedHtml, formatQuoteHeader, sanitizeBodyHtml } from '@/utils/email';
import { cn, formatBytes } from '@/utils/strings';
import { API_ENDPOINTS } from '@/utils/urls';

const AUTO_SAVE_INTERVAL_MS = 1_000;

type EmailMessagesData = inferRouterOutputs<TRPCRouter>['emailMessage']['getEmailMessages'];
type EmailDraft = EmailMessagesData['boardCard']['emailDraft'];
type Participant = NonNullable<EmailDraft>['from'];
type EmailMessage = EmailMessagesData['emailMessagesAsc'][number];
type FileAttachment = NonNullable<EmailDraft>['fileAttachments'][number];

const participantToInput = (participant: Participant) =>
  participant.name ? `${participant.name} <${participant.email}>` : participant.email;

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

  const lastEmailMessage = emailMessagesAsc[emailMessagesAsc.length - 1];

  let defaultFrom = '';
  let defaultTo = '';
  let defaultCc = '';
  let defaultBcc = '';
  if (emailDraft) {
    defaultFrom = participantToInput(emailDraft.from);
    defaultTo = participantsToInput(emailDraft.to);
    defaultCc = participantsToInput(emailDraft.cc);
    defaultBcc = participantsToInput(emailDraft.bcc);
  } else if (lastEmailMessage) {
    defaultTo = lastEmailMessage.sent
      ? participantsToInput(lastEmailMessage.to)
      : participantToInput(lastEmailMessage.from);
    defaultCc = participantsToInput(lastEmailMessage.cc);
  }
  const [fromInput, setFromInput] = useState(defaultFrom);
  const [toInput, setToInput] = useState(defaultTo);
  const [ccInput, setCcInput] = useState(defaultCc);
  const [bccInput, setBccInput] = useState(defaultBcc);
  const [showCcBcc, setShowCcBcc] = useState(defaultCc !== '' || defaultBcc !== '');
  const [hasChanges, setHasChanges] = useState(!emailDraft);
  const autosaveIntervalRef = useRef<number | null>(null);
  const [blockquotesExpanded, setBlockquotesExpanded] = useState(false);
  const blockquotesIframeRef = useRef<HTMLIFrameElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>(emailDraft?.fileAttachments || []);

  const { data: emailAddressesData } = useQuery({ ...trpc.emailAddress.getEmailAddresses.queryOptions({ boardId }) });
  const emailAddresses = emailAddressesData?.emailAddresses || [];

  // Set default "From" address using loaded email addresses
  useEffect(() => {
    if (emailAddresses.length === 0) return;

    const lastEmailParticipantEmails = new Set<string>([
      lastEmailMessage?.from.email,
      ...(lastEmailMessage?.to?.map((p) => p.email) ?? []),
      ...(lastEmailMessage?.cc?.map((p) => p.email) ?? []),
      ...(lastEmailMessage?.bcc?.map((p) => p.email) ?? []),
    ]);

    setFromInput((prev) => {
      if (prev) return prev;
      return (
        emailAddresses.find((addr) => lastEmailParticipantEmails.has(addr.email))?.email ||
        emailAddresses.find((addr) => addr.isDefault)?.email ||
        emailAddresses[0]?.email ||
        ''
      );
    });
  }, [lastEmailMessage, emailAddresses]);

  const emailDraftUpsertMutation = useMutation(
    trpc.emailDraft.upsert.mutationOptions({
      onSuccess: ({ emailDraft }) => {
        queryClient.setQueryData(trpc.emailMessage.getEmailMessages.queryKey({ boardId, boardCardId }), (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, boardCard: { ...oldData.boardCard, emailDraft } } satisfies typeof oldData;
        });
        queryClient.setQueryData(trpc.boardCard.getBoardCards.queryKey({ boardId }), (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCardId ? { ...c, emailDraft } : c)),
          } satisfies typeof oldData;
        });
      },
    }),
  );

  const emailMessagesQueryKey = trpc.emailMessage.getEmailMessages.queryKey({ boardId, boardCardId });
  const optimisticallyDiscardDraft = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: emailMessagesQueryKey,
    onExecute: () => {
      queryClient.setQueryData(emailMessagesQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, boardCard: { ...oldData.boardCard, emailDraft: undefined } } satisfies typeof oldData;
      });
      queryClient.setQueryData(trpc.boardCard.getBoardCards.queryKey({ boardId }), (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.map((c) =>
            c.id === boardCardId ? { ...c, emailDraft: undefined } : c,
          ),
        } satisfies typeof oldData;
      });
    },
    successToast: 'Draft discarded',
    errorToast: 'Failed to discard draft. Please try again.',
    delayedMutation: useMutation(trpc.emailDraft.delete.mutationOptions()),
  });

  const emailDraftSendMutation = useMutation(
    trpc.emailDraft.send.mutationOptions({
      onSuccess: ({ emailMessage, boardCard }) => {
        queryClient.setQueryData(emailMessagesQueryKey, (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            boardCard,
            emailMessagesAsc: [...oldData.emailMessagesAsc, emailMessage],
          } satisfies typeof oldData;
        });
        queryClient.setQueryData(trpc.boardCard.getBoardCards.queryKey({ boardId }), (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCard.id ? boardCard : c)),
          } satisfies typeof oldData;
        });
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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.extend({
        inclusive: false,
      }).configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https'],
      }),
      TextStyle.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fontSize: {
              default: DEFAULT_FONT_SIZE,
              parseHTML: (element) => element.style.fontSize || null,
              renderHTML: (attributes) => {
                if (!attributes.fontSize) return {};
                return { style: `font-size: ${attributes.fontSize}` };
              },
            },
          };
        },
      }),
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily.configure({ types: ['textStyle'] }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: emailDraft?.bodyHtml?.split(sanitizedQuotedHtml)[0] ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 my-3 text-sm',
      },
      handleClickOn(_view, _pos, _node, _nodePos, event) {
        const target = event.target as HTMLElement;
        if (target.tagName === 'A' || target.closest('a')) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
        return false;
      },
      transformPastedHTML(html) {
        // Sanitize pasted content by only allowing supported font families, sizes, and colors
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const processElement = (element: Element) => {
          if (element instanceof HTMLElement) {
            const computedStyle = element.style;

            if (computedStyle.fontFamily) {
              const fontFamily = computedStyle.fontFamily;
              const isSupportedFont = FONT_FAMILIES.some((font) => fontFamily.includes(font.value));
              if (!isSupportedFont) {
                element.style.fontFamily = DEFAULT_FONT_FAMILY.value;
              }
            }

            if (computedStyle.fontSize) {
              const fontSize = computedStyle.fontSize;
              if (!FONT_SIZES.includes(fontSize)) {
                element.style.fontSize = DEFAULT_FONT_SIZE;
              }
            }

            if (computedStyle.color) {
              const color = computedStyle.color;
              if (!color.startsWith('#') || !COLORS.includes(color.toUpperCase())) {
                element.style.removeProperty('color');
              }
            }

            if (computedStyle.backgroundColor) {
              const bgColor = computedStyle.backgroundColor;
              if (!bgColor.startsWith('#') || !COLORS.includes(bgColor.toUpperCase())) {
                element.style.removeProperty('background-color');
              }
            }
          }
          for (const child of Array.from(element.children)) {
            processElement(child);
          }
        };

        processElement(doc.body);
        return doc.body.innerHTML;
      },
    },
    onCreate: ({ editor }) => {
      editor
        .chain()
        .focus()
        .setFontFamily(DEFAULT_FONT_FAMILY.value)
        .setMark('textStyle', { fontSize: DEFAULT_FONT_SIZE })
        .run();
    },
  });

  useEffect(() => {
    if (!editor) return;
    const updateHandler = () => setHasChanges(true);
    editor.on('update', updateHandler);
    return () => {
      editor.off('update', updateHandler);
    };
  }, [editor]);

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
        from: fromInput.trim(),
        to: toInput ? parseParticipantsInput(toInput) : undefined,
        cc: ccInput ? parseParticipantsInput(ccInput) : undefined,
        bcc: bccInput ? parseParticipantsInput(bccInput) : undefined,
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
    fromInput,
    toInput,
    ccInput,
    bccInput,
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
      from: fromInput.trim(),
      to: toInput ? parseParticipantsInput(toInput) : undefined,
      cc: ccInput ? parseParticipantsInput(ccInput) : undefined,
      bcc: bccInput ? parseParticipantsInput(bccInput) : undefined,
    });
  };

  const handleDiscard = () => {
    if (emailDraft) {
      optimisticallyDiscardDraft({ boardId, boardCardId });
    }
    onDiscard();
  };

  const handleFieldChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value);
    setHasChanges(true);
  };

  const uploadAttachment = async (file: File) => {
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
      queryClient.setQueryData(trpc.emailMessage.getEmailMessages.queryKey({ boardId, boardCardId }), (oldData) => {
        if (!oldData?.boardCard.emailDraft) return oldData;
        return {
          ...oldData,
          boardCard: {
            ...oldData.boardCard,
            emailDraft: {
              ...oldData.boardCard.emailDraft,
              fileAttachments: [...(oldData.boardCard.emailDraft.fileAttachments || []), fileAttachment],
            },
          },
        } satisfies typeof oldData;
      });
    } catch (error) {
      console.error('Failed to upload attachment:', error);
    } finally {
      setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(
        `${API_ENDPOINTS.FILE_ATTACHMENT_DELETE}?boardId=${encodeURIComponent(boardId)}&boardCardId=${encodeURIComponent(boardCardId)}&attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!response.ok) throw new Error('Delete failed');

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      queryClient.setQueryData(trpc.emailMessage.getEmailMessages.queryKey({ boardId, boardCardId }), (oldData) => {
        if (!oldData?.boardCard.emailDraft) return oldData;
        return {
          ...oldData,
          boardCard: {
            ...oldData.boardCard,
            emailDraft: {
              ...oldData.boardCard.emailDraft,
              fileAttachments: (oldData.boardCard.emailDraft.fileAttachments || []).filter(
                (a) => a.id !== attachmentId,
              ),
            },
          },
        } satisfies typeof oldData;
      });
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
  });

  return (
    <Card className="p-0 flex flex-col gap-0" {...getRootProps()}>
      {isDragActive && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
          <div className="text-primary font-medium">Drop files here to attach</div>
        </div>
      )}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">From</div>
          <Select
            value={fromInput}
            onValueChange={(value) => {
              setFromInput(value);
              setHasChanges(true);
            }}
          >
            <SelectTrigger size="sm" variant="ghost">
              <SelectValue placeholder={fromInput} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {emailAddresses.map((address: { email: string; name?: string }) => (
                  <SelectItem size="sm" key={address.email} value={address.email}>
                    {address.name ? `${address.name} <${address.email}>` : address.email}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <div className="text-xs text-muted-foreground">To</div>
          <Input inputSize="sm" variant="ghost" value={toInput} onChange={handleFieldChange(setToInput)} />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowCcBcc((prev) => !prev)}
            className="text-muted-foreground"
          >
            {showCcBcc ? 'Hide Cc/Bcc' : 'Add Cc/Bcc'}
          </Button>
        </div>
        {showCcBcc && (
          <>
            <div className="flex items-center gap-1">
              <div className="text-xs text-muted-foreground">Cc</div>
              <Input inputSize="sm" variant="ghost" value={ccInput} onChange={handleFieldChange(setCcInput)} />
            </div>
            <div className="flex items-center gap-1">
              <div className="text-xs text-muted-foreground">Bcc</div>
              <Input inputSize="sm" variant="ghost" value={bccInput} onChange={handleFieldChange(setBccInput)} />
            </div>
          </>
        )}
      </div>
      <MenuBar editor={editor} />
      <EditorContent
        editor={editor}
        className={cn(
          '[&_.tiptap_p]:my-0',
          '[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:ml-5, [&_.tiptap_ul]:pl-1 [&_.tiptap_ul]:ml-5 [&_.tiptap_ul]:mt-2',
          '[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:ml-5 [&_.tiptap_ol]:pl-1 [[&_.tiptap_ol]:ml-5 &_.tiptap_ol]:mt-2',
          '[&_.tiptap_blockquote]:border-l [&_.tiptap_blockquote]:ml-1 [&_.tiptap_blockquote]:pl-2 [&_.tiptap_blockquote]:border-ring',
          '[&_.tiptap_a]:text-blue-700',
          '[&_.tiptap_a]:underline',
        )}
      />
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
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 px-2 py-1 bg-secondary rounded text-xs border border-border"
            >
              <span className="truncate max-w-[200px]">{attachment.filename}</span>
              <span className="text-muted-foreground">({formatBytes(attachment.size)})</span>
              <button
                type="button"
                onClick={() => deleteAttachment(attachment.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
          {uploadingFiles.map((filename) => (
            <div
              key={filename}
              className="flex items-center gap-2 px-2 py-1 bg-secondary/50 rounded text-xs border border-border"
            >
              <Spinner data-icon="inline-start" className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{filename}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2.5 px-3 pb-3">
        <input {...getInputProps()} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            input?.click();
          }}
        >
          Attach
        </Button>
        <Button variant="outline" size="sm" onClick={handleDiscard}>
          {emailDraft ? 'Discard' : 'Cancel'}
        </Button>
        <Button size="sm" onClick={handleSend} disabled={emailDraftSendMutation.isPending}>
          {emailDraftSendMutation.isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              Sending...
            </>
          ) : (
            'Send'
          )}
        </Button>
      </div>
    </Card>
  );
};
