import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const extractUuid = (friendlyId: string) => {
  const parts = friendlyId.split('-');
  return parts.slice(-5).join('-');
};

export const pluralize = (word: string, count: number) => {
  return count === 1 ? word : `${word}s`;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 10) / 10} ${sizes[i]}`;
};
