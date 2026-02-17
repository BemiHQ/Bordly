import { useMutation } from '@tanstack/react-query';
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
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Brush,
  Check,
  ChevronDown,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { type ChangeEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouteContext } from '@/hooks/use-route-context';
import { cn } from '@/utils/strings';

const AUTO_SAVE_INTERVAL_MS = 2_000;

const FONT_FAMILIES = [
  { label: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
];
const DEFAULT_FONT_FAMILY = FONT_FAMILIES[0];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '32px'];
const DEFAULT_FONT_SIZE = '14px';

const COLORS = [
  '#000000',
  '#99A1AF',
  '#FFFFFF',
  '#EF4444',
  '#F59E0B',
  '#FFF085',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
];
const COLOR_BLACK = COLORS[0];
const COLOR_WHITE = COLORS[2];

type EmailMessagesData = inferRouterOutputs<TRPCRouter>['emailMessage']['getEmailMessages'];
type EmailDraft = EmailMessagesData['boardCard']['emailDraft'];
type Participant = NonNullable<EmailDraft>['from'];

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

const MenuBar = ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [disableFontFamilyTooltip, setDisableFontFamilyTooltip] = useState(false);
  const [disableFontSizeTooltip, setDisableFontSizeTooltip] = useState(false);
  const [, forceRerender] = useState({});

  useEffect(() => {
    if (!editor) return;

    const updateHandler = () => forceRerender({});
    editor.on('update', updateHandler);
    editor.on('selectionUpdate', updateHandler);

    const keydownHandler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        const currentLink = editor.getAttributes('link').href;
        setLinkUrl(currentLink || '');
        setIsLinkPopoverOpen(true);
      }
    };

    document.addEventListener('keydown', keydownHandler);

    return () => {
      editor.off('update', updateHandler);
      editor.off('selectionUpdate', updateHandler);
      document.removeEventListener('keydown', keydownHandler);
    };
  }, [editor]);

  if (!editor) return null;

  const currentFontFamilyValue = editor.getAttributes('textStyle').fontFamily || DEFAULT_FONT_FAMILY.value;
  const selectedFontFamilyValue = FONT_FAMILIES.some((font) => font.value === currentFontFamilyValue)
    ? currentFontFamilyValue
    : DEFAULT_FONT_FAMILY;

  const currentTextColor = editor.getAttributes('textStyle').color || COLOR_BLACK;
  const currentHighlightColor = editor.getAttributes('highlight').color || COLOR_WHITE;

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setIsLinkPopoverOpen(false);
    setLinkUrl('');
  };

  const currentAlign = editor.isActive({ textAlign: 'left' })
    ? 'left'
    : editor.isActive({ textAlign: 'center' })
      ? 'center'
      : editor.isActive({ textAlign: 'right' })
        ? 'right'
        : 'left';
  const AlignIcon = currentAlign === 'center' ? AlignCenter : currentAlign === 'right' ? AlignRight : AlignLeft;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-3 px-3 border-t border-border">
      {/* Bold */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().toggleBold().run();
              forceRerender({});
            }}
            className={cn('h-7 px-2', editor.isActive('bold') && 'bg-muted')}
          >
            <Bold className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Bold{' '}
          <KbdGroup>
            <Kbd modifierKey />
            <Kbd>B</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      {/* Italic */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().toggleItalic().run();
              forceRerender({});
            }}
            className={cn('h-7 px-2', editor.isActive('italic') && 'bg-muted')}
          >
            <Italic className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Italic{' '}
          <KbdGroup>
            <Kbd modifierKey />
            <Kbd>I</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      {/* Underline */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().toggleUnderline().run();
              forceRerender({});
            }}
            className={cn('h-7 px-2', editor.isActive('underline') && 'bg-muted')}
          >
            <UnderlineIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Underline{' '}
          <KbdGroup>
            <Kbd modifierKey />
            <Kbd>U</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      {/* Strikethrough */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().toggleStrike().run();
              forceRerender({});
            }}
            className={cn('h-7 px-2', editor.isActive('strike') && 'bg-muted')}
          >
            <Strikethrough className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Strikethrough{' '}
          <KbdGroup>
            <Kbd modifierKey />
            <Kbd>Shift</Kbd>
            <Kbd>S</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-border" />

      {/* Bullet List */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn('h-7 px-2', editor.isActive('bulletList') && 'bg-muted')}
          >
            <List className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bullet list</TooltipContent>
      </Tooltip>

      {/* Ordered List */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn('h-7 px-2', editor.isActive('orderedList') && 'bg-muted')}
          >
            <ListOrdered className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ordered list</TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-border" />

      {/* Link */}
      <Popover
        open={isLinkPopoverOpen}
        onOpenChange={(open) => {
          if (open) {
            const currentLink = editor.getAttributes('link').href;
            setLinkUrl(currentLink || '');
          }
          setIsLinkPopoverOpen(open);
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={cn('h-7 w-7.5 px-1', editor.isActive('link') && 'bg-muted')}>
                <Link2 className="size-[17px]" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            Link{' '}
            <KbdGroup>
              <Kbd modifierKey />
              <Kbd>K</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="flex flex-col gap-2">
            <Input
              inputSize="sm"
              type="url"
              placeholder="Enter URL"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setLink();
                }
              }}
            />
            <div className="flex gap-2 w-fit">
              {editor.isActive('link') ? (
                <>
                  <Button size="sm" variant="outline" onClick={setLink} className="flex-1">
                    Change
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      editor.chain().focus().unsetLink().run();
                      setIsLinkPopoverOpen(false);
                    }}
                    className="flex-1"
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={setLink} className="flex-1">
                  Add Link
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quote */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn('h-7 w-7.5 px-1.5', editor.isActive('blockquote') && 'bg-muted')}
          >
            <Quote className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Blockquote</TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-border" />

      {/* Font Family */}
      <Select
        value={selectedFontFamilyValue}
        onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}
        onOpenChange={(open) => {
          if (!open) {
            setDisableFontFamilyTooltip(true);
            setTimeout(() => setDisableFontFamilyTooltip(false), 100);
          }
        }}
      >
        <Tooltip open={disableFontFamilyTooltip ? false : undefined}>
          <TooltipTrigger asChild>
            <SelectTrigger size="sm" variant="ghost">
              <SelectValue placeholder={DEFAULT_FONT_FAMILY.label} />
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent>Font family</TooltipContent>
        </Tooltip>
        <SelectContent>
          <SelectGroup>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="w-px h-5 bg-border" />

      {/* Font Size */}
      <Select
        value={editor.getAttributes('textStyle').fontSize || DEFAULT_FONT_SIZE}
        onValueChange={(fontSize) => {
          editor
            .chain()
            .focus()
            .setMark('textStyle', { ...editor.getAttributes('textStyle'), fontSize })
            .run();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDisableFontSizeTooltip(true);
            setTimeout(() => setDisableFontSizeTooltip(false), 100);
          }
        }}
      >
        <Tooltip open={disableFontSizeTooltip ? false : undefined}>
          <TooltipTrigger asChild>
            <SelectTrigger size="sm" variant="ghost">
              <SelectValue placeholder={DEFAULT_FONT_SIZE} />
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent>Font size</TooltipContent>
        </Tooltip>
        <SelectContent>
          <SelectGroup>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="w-px h-5 bg-border" />

      {/* Color Picker */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2',
                  (currentTextColor !== COLOR_BLACK || currentHighlightColor !== COLOR_WHITE) && 'bg-muted',
                )}
              >
                <div className="flex items-center gap-1">
                  <Brush className="size-3.5" />
                  <ChevronDown className="size-4 opacity-50" />
                </div>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Text & background color</TooltipContent>
        </Tooltip>
        <PopoverContent className="p-4 w-auto" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">Text color</div>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      forceRerender({});
                    }}
                    className={cn(
                      'cursor-pointer w-6 h-6 rounded border border-border hover:scale-115 transition-transform flex items-center justify-center',
                      currentTextColor === color && 'scale-115',
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {currentTextColor === color && (
                      <Check
                        className={cn(
                          'size-3.5',
                          color === COLOR_WHITE ? 'text-text-secondary' : 'text-primary-foreground',
                        )}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px bg-border" />
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">Background color</div>
              <div className="grid grid-cols-5 gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color }).run();
                      forceRerender({});
                    }}
                    className={cn(
                      'cursor-pointer w-6 h-6 rounded border border-border hover:scale-115 transition-transform flex items-center justify-center',
                      currentHighlightColor === color && 'scale-115',
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {currentHighlightColor === color && (
                      <Check
                        className={cn(
                          'size-3.5',
                          color === COLOR_WHITE ? 'text-text-secondary' : 'text-primary-foreground',
                        )}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Text Alignment */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <div className="flex items-center gap-1">
                  <AlignIcon className="size-4" />
                  <ChevronDown className="size-4 opacity-50" />
                </div>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Text alignment</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-fit p-1" align="start">
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  className={cn('h-7 px-2', editor.isActive({ textAlign: 'left' }) && 'bg-muted')}
                >
                  <AlignLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align left</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  className={cn('h-7 px-2', editor.isActive({ textAlign: 'center' }) && 'bg-muted')}
                >
                  <AlignCenter className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align center</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  className={cn('h-7 px-2', editor.isActive({ textAlign: 'right' }) && 'bg-muted')}
                >
                  <AlignRight className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Align right</TooltipContent>
            </Tooltip>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const ReplyCard = ({
  boardId,
  boardCardId,
  emailDraft,
  onCancel,
}: {
  boardId: string;
  boardCardId: string;
  emailDraft?: EmailDraft;
  onCancel: () => void;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const [fromInput, setFromInput] = useState(emailDraft?.from ? participantToInput(emailDraft.from) : '');
  const [toInput, setToInput] = useState(participantsToInput(emailDraft?.to));
  const [ccInput, setCcInput] = useState(participantsToInput(emailDraft?.cc));
  const [bccInput, setBccInput] = useState(participantsToInput(emailDraft?.bcc));
  const [showCcBcc, setShowCcBcc] = useState((emailDraft?.cc?.length ?? 0) > 0 || (emailDraft?.bcc?.length ?? 0) > 0);
  const [hasChanges, setHasChanges] = useState(false);

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
      if (!editor || emailDraftUpsertMutation.isPending || !hasChanges) return;

      emailDraftUpsertMutation.mutate({
        boardId,
        boardCardId,
        bodyHtml: editor.getHTML(),
        from: fromInput.trim(),
        to: toInput ? parseParticipantsInput(toInput) : undefined,
        cc: ccInput ? parseParticipantsInput(ccInput) : undefined,
        bcc: bccInput ? parseParticipantsInput(bccInput) : undefined,
      });
      setHasChanges(false);
    }, AUTO_SAVE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [
    editor,
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
    if (!editor) return;

    const html = editor.getHTML();
    console.log('Sending reply:', html);
    // TODO: Implement send functionality

    editor.commands.clearContent();
    onCancel();
  };

  const handleFieldChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value);
    setHasChanges(true);
  };

  return (
    <Card className="p-0 flex flex-col gap-0">
      <div className="px-4 py-2">
        <div className="flex items-center">
          <div className="text-xs text-muted-foreground">From</div>
          <Input inputSize="sm" variant="ghost" value={fromInput} onChange={handleFieldChange(setFromInput)} />
        </div>
        <div className="flex items-center">
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
            <div className="flex items-center">
              <div className="text-xs text-muted-foreground">Cc</div>
              <Input inputSize="sm" variant="ghost" value={ccInput} onChange={handleFieldChange(setCcInput)} />
            </div>
            <div className="flex items-center">
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
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSend}>
          Send
        </Button>
      </div>
    </Card>
  );
};
