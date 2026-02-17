import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type * as React from 'react';

import { cn } from '@/utils/strings';

const AVATAR_COLORS = [
  'bg-orange-600 text-white',
  'bg-amber-600 text-white',
  'bg-yellow-600 text-white',
  'bg-lime-600 text-white',
  'bg-green-600 text-white',
  'bg-emerald-600 text-white',
  'bg-teal-600 text-white',
  'bg-cyan-600 text-white',
  'bg-sky-600 text-white',
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-violet-600 text-white',
  'bg-fuchsia-600 text-white',
];

export const Avatar = ({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: 'default' | 'lg' | 'sm' | 'xs' | '2xs';
}) => {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none',
        'data-[size=lg]:size-10',
        'data-[size=sm]:size-6',
        'data-[size=xs]:size-5',
        'data-[size=2xs]:size-4',
        className,
      )}
      {...props}
    />
  );
};

export const AvatarImage = ({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) => {
  return (
    <AvatarPrimitive.Image data-slot="avatar-image" className={cn('aspect-square size-full', className)} {...props} />
  );
};

export const AvatarFallback = ({
  className,
  hashForBgColor,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & {
  hashForBgColor: string;
}) => {
  const colorClassFromText = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full',
        'text-sm',
        'group-data-[size=sm]/avatar:text-xs',
        'group-data-[size=xs]/avatar:text-2xs',
        'group-data-[size=2xs]/avatar:text-2xs',
        colorClassFromText(hashForBgColor),
        className,
      )}
      {...props}
    />
  );
};

export const AvatarBadge = ({ className, ...props }: React.ComponentProps<'span'>) => {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        'bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 select-none',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=xs]/avatar:size-1 group-data-[size=xs]/avatar:[&>svg]:hidden',
        'group-data-[size=2xs]/avatar:size-1 group-data-[size=2xs]/avatar:[&>svg]:hidden',
        className,
      )}
      {...props}
    />
  );
};

export const AvatarGroup = ({
  className,
  avatars,
  ...props
}: React.ComponentProps<'div'> & { avatars: React.ReactNode[] }) => {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        '*:data-[slot=avatar]:ring-background group/avatar-group flex -space-x-1 *:data-[slot=avatar]:bg-background',
        '[&>*:first-child]:z-10 [&>*:nth-child(2)]:z-9 [&>*:nth-child(3)]:z-8 [&>*:nth-child(4)]:z-7 [&>*:nth-child(5)]:z-6',
        avatars.length === 1 ? '' : '*:data-[slot=avatar]:ring-2',
        className,
      )}
      {...props}
    >
      {avatars.reverse()}
    </div>
  );
};

export const AvatarGroupCount = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm ring-2',
        'group-has-data-[size=lg]/avatar-group:size-10',
        'group-has-data-[size=sm]/avatar-group:size-6',
        '[&>svg]:size-4',
        'group-has-data-[size=lg]/avatar-group:[&>svg]:size-5',
        'group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
        'group-has-data-[size=xs]/avatar-group:[&>svg]:size-2',
        'group-has-data-[size=2xs]/avatar-group:[&>svg]:size-2',
        className,
      )}
      {...props}
    />
  );
};
