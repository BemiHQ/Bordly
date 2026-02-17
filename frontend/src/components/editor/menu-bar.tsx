import type { useEditor } from '@tiptap/react';
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
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/utils/strings';

export const FONT_FAMILIES = [
  { label: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
];
export const DEFAULT_FONT_FAMILY = FONT_FAMILIES[0];

export const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '32px'];
export const DEFAULT_FONT_SIZE = '14px';

export const COLORS = [
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

export const MenuBar = ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
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
              <SelectItem size="sm" key={font.value} value={font.value}>
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
              <SelectItem size="sm" key={size} value={size}>
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
                      'cursor-pointer w-5.5 h-5.5 rounded border border-border hover:scale-115 transition-transform flex items-center justify-center',
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
                      'cursor-pointer w-5.5 h-5.5 rounded border border-border hover:scale-115 transition-transform flex items-center justify-center',
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
