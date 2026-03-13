#!/usr/bin/env tsx

import { RequestContext } from '@mikro-orm/postgresql';
import type { BoardCard } from '@/entities/board-card';
import { EmailMessage } from '@/entities/email-message';
import { ArchiveService } from '@/services/archive.service';
import { EmailMessageService } from '@/services/email-message.service';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';
import { orm } from '@/utils/orm';

if (ENV.NODE_ENV === 'production') {
  Logger.error('This test should not be run in production environment');
  process.exit(1);
}

const BOARD_CARD_ID = '550e8400-e29b-41d4-a716-446655440000';
const EXTERNAL_THREAD_ID = 'thread-123456';
const GMAIL_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440100';
const DOMAIN_ID = '550e8400-e29b-41d4-a716-446655440200';
const EMAIL_MESSAGES = [
  new EmailMessage({
    gmailAccount: { id: GMAIL_ACCOUNT_ID } as never,
    domain: { id: DOMAIN_ID } as never,
    externalId: 'ext-1',
    externalThreadId: EXTERNAL_THREAD_ID,
    externalCreatedAt: new Date('2026-01-01T10:00:00Z'),
    messageId: 'msg-1@example.com',
    references: undefined,
    from: { name: 'Sender One', email: 'sender1@example.com' },
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    replyTo: undefined,
    cc: undefined,
    bcc: undefined,
    subject: 'Test Subject 1',
    snippet: 'This is a test email',
    bodyText: 'This is test email 1',
    bodyHtml: '<p>This is test email 1</p>',
    sent: true,
    labels: ['INBOX'],
    rawPayload: {},
  }),
  new EmailMessage({
    gmailAccount: { id: GMAIL_ACCOUNT_ID } as never,
    domain: { id: DOMAIN_ID } as never,
    externalId: 'ext-2',
    externalThreadId: EXTERNAL_THREAD_ID,
    externalCreatedAt: new Date('2026-01-01T11:00:00Z'),
    messageId: 'msg-2@example.com',
    references: 'msg-1@example.com',
    from: { name: 'Sender Two', email: 'sender2@example.com' },
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    replyTo: { name: 'Sender One', email: 'sender1@example.com' },
    cc: [{ name: 'CC User', email: 'cc@example.com' }],
    bcc: undefined,
    subject: 'Test Subject 2',
    snippet: 'This is another test email',
    bodyText: 'This is test email 2',
    bodyHtml: '<p>This is test email 2</p>',
    sent: false,
    labels: ['INBOX', 'UNREAD'],
    rawPayload: { headers: [] },
  }),
];
EMAIL_MESSAGES[0]!.id = '550e8400-e29b-41d4-a716-446655440001';
EMAIL_MESSAGES[1]!.id = '550e8400-e29b-41d4-a716-446655440002';

async function runTests() {
  try {
    const boardCard = { id: BOARD_CARD_ID, externalThreadId: EXTERNAL_THREAD_ID } as BoardCard;

    console.log('✓ Archiving email messages...');
    await ArchiveService.archiveBoardCardEmailMessages(boardCard);

    console.log('✓ Verifying email messages archiving...');
    const removedMessages = mockRemovedMessages;
    assertEqual(removedMessages.length, 4); // Include attachments removal calls
    assert(!!removedMessages.find((msg) => msg.id === EMAIL_MESSAGES[0]!.id));
    assert(!!removedMessages.find((msg) => msg.id === EMAIL_MESSAGES[1]!.id));

    console.log('✓ Getting last archived email message...');
    let lastMessage = await ArchiveService.getLastEmailMessage(EXTERNAL_THREAD_ID);
    assert(!!lastMessage);
    assertEqual(lastMessage!.id, EMAIL_MESSAGES[1]!.id);
    assertEqual(lastMessage!.externalThreadId, EXTERNAL_THREAD_ID);
    assertEqual(lastMessage!.subject, 'Test Subject 2');
    assertEqual(lastMessage!.bodyText, 'This is test email 2');
    assertEqual(lastMessage!.domain.id, DOMAIN_ID);

    console.log('✓ Testing deletion by email message IDs...');
    await ArchiveService.deleteByEmailMessageIds([EMAIL_MESSAGES[1]!.id]);
    lastMessage = await ArchiveService.getLastEmailMessage(EXTERNAL_THREAD_ID);
    assert(!!lastMessage);
    assertEqual(lastMessage!.id, EMAIL_MESSAGES[0]!.id);

    console.log('✓ Testing deletion by external thread IDs...');
    await ArchiveService.deleteByExternalThreadIds([EXTERNAL_THREAD_ID]);
    lastMessage = await ArchiveService.getLastEmailMessage(EXTERNAL_THREAD_ID);
    assert(!lastMessage);

    console.log('✓ Re-archiving email messages...');
    await ArchiveService.archiveBoardCardEmailMessages(boardCard);
    console.log('✓ Restoring email messages...');
    await ArchiveService.restoreBoardCardEmailMessages(boardCard);

    console.log('✓ Compacting tables...');
    await ArchiveService.compactTable();

    console.log('✓ Verifying restoration...');
    const persistedMessages = mockPersistedMessages;
    assertEqual(persistedMessages.length, 2);
    assert(!!persistedMessages.find((msg) => msg.id === EMAIL_MESSAGES[0]!.id));
    assert(!!persistedMessages.find((msg) => msg.id === EMAIL_MESSAGES[1]!.id));

    console.log('✓ Verifying archival deletion...');
    lastMessage = await ArchiveService.getLastEmailMessage(EXTERNAL_THREAD_ID);
    assert(!lastMessage);

    console.log('✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------------------------------------------------

// Mock S3 prefix
ArchiveService.s3Prefix = () => 'archive-test';

// Mock ORM
const mockPersistedMessages: Array<{ id: string }> = [];
const mockRemovedMessages: Array<{ id: string }> = [];
orm.em.flush = (async () => {}) as never;
orm.em.remove = ((entity: { id: string }) => {
  mockRemovedMessages.push(entity);
}) as never;
orm.em.persist = ((entity: { id: string }) => {
  mockPersistedMessages.push(entity);
}) as never;

// Mock EmailMessageService
(EmailMessageService.findEmailMessagesByBoardCard as unknown) = async () => EMAIL_MESSAGES;

const assert = (condition: boolean) => {
  if (!condition) {
    throw new Error('Assertion failed');
  }
};
const assertEqual = (a: unknown, b: unknown) => {
  if (a !== b) {
    throw new Error(`Assertion failed: ${a} !== ${b}`);
  }
};

await RequestContext.create(orm.em, runTests);
