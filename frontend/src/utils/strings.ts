import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const extractUuid = (friendlyId: string) => {
  const parts = friendlyId.split('-');
  return parts.slice(-5).join('-');
};

export const humanizedEmailParticipant = (email: string) => {
  // Remove quotes
  let result = email.replaceAll('"', '');

  // Extract name from First Name <email>
  const match = result.match(/^(.*)<.*>$/);
  if (match) result = match[1];

  // Remove < >
  result = result.replaceAll('<', '').replaceAll('>', '');

  if (result.startsWith('undisclosed-recipients')) return null;

  return result.trim();
};

export const emailParticipantDomain = (email: string) => {
  const match = email.match(/@([^>\s]+)/);
  if (match) return match[1].toLowerCase();
  return null;
};

export const renderHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};
