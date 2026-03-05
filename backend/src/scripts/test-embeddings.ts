#!/usr/bin/env tsx

import { CommentService } from '@/services/comment.service';
import { EmailMessageService } from '@/services/email-message.service';
import { EmbeddingService } from '@/services/embedding.service';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';

if (ENV.NODE_ENV === 'production') {
  Logger.error('This test should not be run in production environment');
  process.exit(1);
}

const BOARD_ID = 'test-board-123';
const EMAIL_MESSAGE_ID1 = '550e8400-e29b-41d4-a716-446655440001';
const EMAIL_MESSAGE_ID2 = '550e8400-e29b-41d4-a716-446655440002';
const COMMENT_ID = '550e8400-e29b-41d4-a716-446655440003';
const BOARD_CARD_ID1 = '550e8400-e29b-41d4-a716-446655440010';
const BOARD_CARD_ID2 = '550e8400-e29b-41d4-a716-446655440020';

async function runTests() {
  try {
    console.log('✓ Upserting email message embeddings...');
    await EmbeddingService.upsertRecords(BOARD_ID, {
      entity: 'EmailMessage',
      ids: [EMAIL_MESSAGE_ID1, EMAIL_MESSAGE_ID2],
      boardCardId: BOARD_CARD_ID1,
    });

    console.log('✓ Searching for similar records...');
    let records = await EmbeddingService.searchSemantic(BOARD_ID, { query: 'project planning' });
    console.log(records);
    assertEqual(records.length, 2);
    for (const record of records) {
      assert([EMAIL_MESSAGE_ID1, EMAIL_MESSAGE_ID2].includes(record.id));
      assert(record.distance > 0.0 && record.distance <= 1.0);
      assertEqual(record.entity, 'EmailMessage');
      assertEqual(record.boardCardId, BOARD_CARD_ID1);
      assertEqual(record.updatedAt.getTime(), new Date('2026-01-01T01:00:00Z').getTime());
    }

    console.log('✓ Upserting comment embeddings...');
    await EmbeddingService.upsertRecords(BOARD_ID, {
      entity: 'Comment',
      ids: [COMMENT_ID],
      boardCardId: BOARD_CARD_ID2,
    });

    console.log('✓ Deleting specific records...');
    await EmbeddingService.deleteRecords(BOARD_ID, { entity: 'EmailMessage', ids: [EMAIL_MESSAGE_ID2] });

    console.log('✓ Compacting tables...');
    await EmbeddingService.compactTables();

    console.log('✓ Searching for similar records...');
    records = await EmbeddingService.searchSemantic(BOARD_ID, { query: 'project planning' });
    assertEqual(records.length, 2);
    const email1 = records.find((r) => r.id === EMAIL_MESSAGE_ID1)!;
    assertEqual(email1.id, EMAIL_MESSAGE_ID1);
    const comment = records.find((r) => r.id === COMMENT_ID)!;
    assertEqual(comment.id, COMMENT_ID);
    assertEqual(comment.entity, 'Comment');
    assertEqual(comment.boardCardId, BOARD_CARD_ID2);
    assertEqual(comment.updatedAt.getTime(), new Date('2026-01-01T12:00:00Z').getTime());

    console.log('✓ Deleting records by board card...');
    await EmbeddingService.deleteRecordsByBoardCards(BOARD_ID, { boardCardIds: [BOARD_CARD_ID1] });

    console.log('✓ Searching for similar records...');
    records = await EmbeddingService.searchSemantic(BOARD_ID, { query: 'project planning' });
    assertEqual(records.length, 1);
    assertEqual(records[0]!.id, COMMENT_ID);

    console.log('✓ Deleting test table...');
    await EmbeddingService.deleteTable(BOARD_ID);

    console.log('✓ Searching for similar records...');
    records = await EmbeddingService.searchSemantic(BOARD_ID, { query: 'project planning' });
    assertEqual(records.length, 0);

    console.log('✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await EmbeddingService.deleteTable(BOARD_ID);
  }
}

// ---------------------------------------------------------------------------------------------------------------------

// Mock S3 prefix
EmbeddingService.s3Prefix = () => 'embeddings-test';
// Mock services
(EmailMessageService.findByIds as unknown) = async (ids: string[]) => {
  return ids.map((id) => ({
    id,
    updatedAt: new Date('2026-01-01T01:00:00Z'),
    subject: 'Test Subject',
    from: { name: 'Test Sender', emailAddress: 'sender@test.com' },
    to: [],
    cc: [],
    bcc: [],
    bodyText: 'Email about project planning',
    bodyHtml: '<p>Email about project planning</p>',
    gmailAttachments: [],
  }));
};
(CommentService.findByIds as unknown) = async (ids: string[]) => {
  return ids.map((id) => ({
    id,
    updatedAt: new Date('2026-01-01T12:00:00Z'),
    loadedUser: { firstName: 'Test', lastName: 'User' },
    contentText: 'This is a great discussion about planning',
  }));
};
// Mock OpenAI
EmbeddingService.generateEmbedding = async (text: string) => {
  const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const base = new Array(1536).fill(0);
  for (let i = 0; i < 1536; i++) {
    base[i] = Math.sin((hash + i) / 100) * 0.5 + 0.5;
  }
  const magnitude = Math.sqrt(base.reduce((sum, val) => sum + val * val, 0));
  return base.map((val) => val / magnitude);
};

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

runTests();
