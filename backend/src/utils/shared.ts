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

export const isCommentForBordly = (text: string) => text.trim().toLowerCase().startsWith('@bordly');

export const replyEmailFields = ({
  replyToMessage,
  senderEmailAddresses,
}: {
  replyToMessage: {
    from: Participant;
    to?: Participant[];
    cc?: Participant[];
    bcc?: Participant[];
    replyTo?: Participant;
  };
  senderEmailAddresses: {
    email: string;
    name?: string | null;
    isDefault: boolean;
  }[];
}) => {
  if (senderEmailAddresses.length === 0) throw new Error('No sender email addresses available');

  const emailParticipantEmails = new Set<string>([
    replyToMessage.from.email,
    ...(replyToMessage.to?.map((p) => p.email) ?? []),
    ...(replyToMessage.cc?.map((p) => p.email) ?? []),
    ...(replyToMessage.bcc?.map((p) => p.email) ?? []),
  ]);
  const fromEmailAddress =
    senderEmailAddresses.find((addr) => emailParticipantEmails.has(addr.email)) ||
    senderEmailAddresses.find((addr) => addr.isDefault) ||
    senderEmailAddresses[0]!;

  const from = { email: fromEmailAddress.email, name: fromEmailAddress.name || null } as Participant;

  const sent = replyToMessage.from.email === from.email;
  const to = sent ? replyToMessage.to : replyToMessage.replyTo ? [replyToMessage.replyTo] : [replyToMessage.from];
  const cc = [
    ...(sent ? [] : (replyToMessage.to?.filter((p) => p.email !== from.email) ?? [])),
    ...(replyToMessage.cc?.filter((p) => p.email !== from.email) ?? []),
  ];

  return { from, to: to && to.length > 0 ? to : undefined, cc: cc.length > 0 ? cc : undefined };
};

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
