import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { cva, type VariantProps } from 'class-variance-authority';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import type { BoardMember } from '@/query-helpers/board';
import { cn } from '@/utils/strings';

const mentionTextareaVariants = cva('', {
  variants: {
    size: {
      default: 'text-sm',
      sm: 'text-xs',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

interface MentionTextareaProps extends VariantProps<typeof mentionTextareaVariants> {
  boardMembers: BoardMember[];
  value: string;
  onChange: (value: { html: string; text: string }) => void;
  onMentionStateChange?: (isShowingMentions: boolean) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface MentionListProps {
  items: BoardMember[];
  command: (item: BoardMember) => void;
}

const MentionList = ({ items, command }: MentionListProps, ref: React.Ref<MentionListRef>) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (items[selectedIndex]) {
          command(items[selectedIndex]);
          return true;
        }
      }
      return false;
    },
  }));

  return (
    <div className="max-h-[200px] overflow-y-auto p-1">
      {items.map((member, index) => (
        <div
          key={member.user.id}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm',
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
          onClick={() => command(member)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Avatar size="xs">
            <AvatarImage src={member.user.photoUrl} alt={member.user.fullName} />
          </Avatar>
          <span>{member.user.fullName}</span>
        </div>
      ))}
    </div>
  );
};

const MentionListForwardRef = React.forwardRef(MentionList);

export const MentionTextarea = ({
  boardMembers,
  value,
  onChange,
  onMentionStateChange,
  onKeyDown,
  placeholder,
  className,
  autoFocus,
  size = 'default',
}: MentionTextareaProps) => {
  const [showMentions, setShowMentions] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const suggestionPopupRef = useRef<HTMLDivElement | null>(null);
  const isInternalChange = useRef(false);

  const getSuggestionItems = useCallback(
    (query: string) => {
      return boardMembers.filter((member) => member.user.fullName.toLowerCase().includes(query.toLowerCase()));
    },
    [boardMembers],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            style: 'margin: 0; line-height: 1.5;',
          },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'font-semibold text-accent-blue',
        },
        suggestion: {
          items: ({ query }: { query: string }) => getSuggestionItems(query),
          render: () => {
            let component: ReactRenderer<MentionListRef, MentionListProps> | undefined;
            let popup: HTMLDivElement | undefined;

            return {
              onStart: (props: SuggestionProps<BoardMember>) => {
                if (!props.items.length) return;

                popup = document.createElement('div');
                popup.className =
                  'fixed z-[9999] min-w-[200px] max-w-[300px] bg-popover text-popover-foreground rounded-md border shadow-md overflow-hidden mb-2';
                document.body.appendChild(popup);
                suggestionPopupRef.current = popup;

                component = new ReactRenderer(MentionListForwardRef, {
                  props: {
                    items: props.items,
                    command: (item: BoardMember) => {
                      props.command({ id: item.user.id, label: item.user.fullName });
                    },
                  },
                  editor: props.editor,
                });

                if (component.element) {
                  popup.appendChild(component.element);
                }

                setShowMentions(true);
              },
              onUpdate(props: SuggestionProps<BoardMember>) {
                if (component) {
                  component.updateProps({
                    items: props.items,
                    command: (item: BoardMember) => {
                      props.command({ id: item.user.id, label: item.user.fullName });
                    },
                  });
                }

                if (!props.items.length && popup) {
                  popup.remove();
                  popup = undefined;
                  suggestionPopupRef.current = null;
                  setShowMentions(false);
                  return;
                }

                if (popup && props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    popup.style.bottom = `${window.innerHeight - rect.top - 4}px`;
                    popup.style.left = `${rect.left}px`;
                  }
                }
              },
              onKeyDown(props: SuggestionKeyDownProps) {
                if (props.event.key === 'Escape') {
                  if (popup) {
                    popup.remove();
                    popup = undefined;
                    suggestionPopupRef.current = null;
                  }
                  setShowMentions(false);
                  return true;
                }

                if (component?.ref) {
                  return component.ref.onKeyDown(props);
                }
                return false;
              },
              onExit() {
                if (popup) {
                  popup.remove();
                  popup = undefined;
                  suggestionPopupRef.current = null;
                }
                if (component) {
                  component.destroy();
                  component = undefined;
                }
                setShowMentions(false);
              },
            };
          },
        } as Partial<SuggestionOptions<BoardMember>>,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'flex field-sizing-content w-full px-3 py-2 placeholder:text-muted-foreground',
          'rounded-md border border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
          'bg-transparent dark:bg-input/30 shadow-xs transition-[color,box-shadow]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:pointer-events-none',
          mentionTextareaVariants({ size }),
          className,
        ),
      },
      handleKeyDown: (_view, event) => {
        if (onKeyDown && !showMentions) {
          if (event.key === 'Enter' && !event.shiftKey) {
            onKeyDown(event);
            return true;
          }
          onKeyDown(event);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      isInternalChange.current = true;
      onChange({ html: html === '<p></p>' ? '' : html, text });
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    const currentHtml = editor.getHTML();
    const normalizedValue = value === '' ? '<p></p>' : value;
    const normalizedCurrent = currentHtml === '<p></p>' ? '' : currentHtml;

    if (normalizedValue !== normalizedCurrent) {
      editor.commands.setContent(normalizedValue);
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor && autoFocus) {
      editor.commands.focus('end');
    }
  }, [editor, autoFocus]);

  useEffect(() => {
    onMentionStateChange?.(showMentions);
  }, [showMentions, onMentionStateChange]);

  return <EditorContent editor={editor} ref={editorRef} />;
};

export const renderCommentHtml = (html: string) => {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated by Tiptap editor
  return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
};
