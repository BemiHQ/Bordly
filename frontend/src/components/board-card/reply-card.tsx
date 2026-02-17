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
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
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
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { useRouteContext } from '@/hooks/use-route-context';
import { cn } from '@/utils/strings';

const AUTO_SAVE_INTERVAL_MS = 1_000;

type EmailMessagesData = inferRouterOutputs<TRPCRouter>['emailMessage']['getEmailMessages'];
type EmailDraft = EmailMessagesData['boardCard']['emailDraft'];
type Participant = NonNullable<EmailDraft>['from'];
type EmailMessage = EmailMessagesData['emailMessagesAsc'][number];

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
  const [hasChanges, setHasChanges] = useState(false);
  const autosaveIntervalRef = useRef<number | null>(null);

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
    content: emailDraft?.bodyHtml ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 my-3 text-sm',
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
        bodyHtml: editor.getHTML(),
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
      bodyHtml: editor.getHTML(),
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

  return (
    <Card className="p-0 flex flex-col gap-0">
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
      <div className="flex justify-end gap-2.5 px-3 pb-3">
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
