import { cn } from '@/utils/strings';

const isMac = () => {
  if (typeof window === 'undefined') return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) || /Mac/i.test(navigator.userAgent);
};

const getModifierKey = () => {
  return isMac() ? '⌘' : 'Ctrl';
};

export const Kbd = ({
  className,
  modifierKey,
  children,
  ...props
}: React.ComponentProps<'kbd'> & { modifierKey?: boolean }) => {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none',
        "[&_svg:not([class*='size-'])]:size-3",
        '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
        className,
      )}
      {...props}
    >
      {modifierKey ? getModifierKey() : children}
    </kbd>
  );
};

export const KbdGroup = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return <kbd data-slot="kbd-group" className={cn('inline-flex items-center gap-1', className)} {...props} />;
};
