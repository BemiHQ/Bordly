export const QUERY_PARAMS = {
  ADDED_GMAIL_ACCOUNT: 'addedGmailAccount',
};

export const ERRORS = {
  NO_GMAIL_ACCESS: 'NO_GMAIL_ACCESS',
};

export const FALLBACK_SUBJECT = '(No Subject)';

export enum BoardCardState {
  INBOX = 'INBOX',
  ARCHIVED = 'ARCHIVED',
  SPAM = 'SPAM',
  TRASH = 'TRASH',
}

export enum BoardMemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  AGENT = 'AGENT',
}

export enum GmailAccountState {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum MemoryFormality {
  FORMAL = 'formal',
  CASUAL = 'casual',
  SEMI_FORMAL = 'semi-formal',
}

export interface Participant {
  name: string | null;
  email: string;
}

export const participantToString = (p: Participant) => (p.name ? `${p.name} <${p.email}>` : p.email);

export const isBordlyComment = (text: string) => text.trim().toLowerCase().startsWith('@bordly');

export const createQuotedHtml = ({
  from,
  sentAt,
  html,
  text,
}: {
  from: Participant;
  sentAt: string;
  html: string;
  text: string;
}): string => {
  const quoteHeader =
    `On ${sentAt} ${from.name || from.email} ` +
    `<<a href="mailto:${from.email}" target="_blank" rel="noopener noreferrer">${from.email}</a>> wrote:`;

  return `
<div class="gmail_quote">
  <div dir="ltr" class="gmail_attr">${quoteHeader}<br></div>
  <blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
    ${html || (text ? textToHtml(text) : '')}
  </blockquote>
</div>`;
};

// ---------------------------------------------------------------------------------------------------------------------

const textToHtml = (text: string): string => {
  return text
    .split('\n')
    .map((line) => `<div>${line || '<br>'}</div>`)
    .join('');
};
