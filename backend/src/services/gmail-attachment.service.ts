import type { Populate } from '@mikro-orm/postgresql';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { orm } from '@/utils/orm';

export class GmailAttachmentService {
  static async findByIdAndExternalThreadId<Hint extends string = never>(
    gmailAttachmentId: string,
    { externalThreadId, populate }: { externalThreadId: string; populate?: Populate<GmailAttachment, Hint> },
  ) {
    return orm.em.findOneOrFail(
      GmailAttachment,
      { id: gmailAttachmentId, emailMessage: { externalThreadId } },
      { populate },
    );
  }
}
