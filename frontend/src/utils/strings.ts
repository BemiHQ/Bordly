import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const extractUuid = (friendlyId: string) => {
  const parts = friendlyId.split('-');
  return parts.slice(-5).join('-');
};
