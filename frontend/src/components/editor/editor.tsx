import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, type useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import {
  COLORS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZES,
} from '@/components/editor/menu-bar';

export const editorConfig = ({ initialHtml }: { initialHtml?: string }): Parameters<typeof useEditor>[0] => ({
  extensions: [
    StarterKit.configure({
      paragraph: {
        HTMLAttributes: {
          style: `margin: 0; line-height: 1.5; font-size: ${DEFAULT_FONT_SIZE};`,
        },
      },
      bulletList: {
        HTMLAttributes: {
          style: 'list-style-type: disc; margin-left: 1.25rem; padding-left: 0.25rem; margin-top: 0.5rem;',
        },
      },
      orderedList: {
        HTMLAttributes: {
          style: 'list-style-type: decimal; margin-left: 1.25rem; padding-left: 0.25rem; margin-top: 0.5rem;',
        },
      },
      blockquote: {
        HTMLAttributes: {
          style: 'border-left: 1px solid #d1d5db; margin-left: 0.25rem; padding-left: 0.5rem;',
        },
      },
    }),
    Link.extend({
      inclusive: false,
    }).configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      protocols: ['http', 'https'],
      HTMLAttributes: {
        style: 'color: #1d4ed8; text-decoration: underline;',
      },
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
  content: initialHtml || '',
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

export const Editor = ({ editor, onChange }: { editor: ReturnType<typeof useEditor>; onChange: () => void }) => {
  useEffect(() => {
    if (!editor) return;
    editor.on('update', onChange);
    return () => {
      editor.off('update', onChange);
    };
  }, [editor, onChange]);

  return <EditorContent editor={editor} />;
};
