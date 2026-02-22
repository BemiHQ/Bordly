import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { useEffect, useRef } from 'react';

import { cn } from '@/utils/strings';

const textareaVariants = cva('', {
  variants: {
    size: {
      default: 'text-sm placeholder:text-sm',
      sm: 'text-xs placeholder:text-xs',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

export const Textarea = ({
  className,
  autoResize,
  size = 'default',
  ...props
}: React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants> & { autoResize?: boolean }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: value is needed to resize textarea
  useEffect(() => {
    if (textareaRef.current && autoResize) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, [props.value, props.defaultValue, autoResize]);

  return (
    <textarea
      ref={textareaRef}
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content w-full px-3 py-2 placeholder:text-muted-foreground',
        'rounded-md border border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
        'bg-transparent dark:bg-input/30 shadow-xs transition-[color,box-shadow]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        'disabled:cursor-not-allowed disabled:opacity-50',
        textareaVariants({ size }),
        autoResize && 'resize-none',
        className,
      )}
      {...props}
    />
  );
};
