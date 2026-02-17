export const QUERY_PARAMS = {
  ADDED_GMAIL_ACCOUNT: 'addedGmailAccount',
};

export const ERRORS = {
  NO_GMAIL_ACCESS: 'NO_GMAIL_ACCESS',
};

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
