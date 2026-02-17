import type { Populate } from '@mikro-orm/postgresql';
import { Attachment } from '@/entities/attachment';
import { orm } from '@/utils/orm';

export class AttachmentService {
  static async findByIdAndExternalThreadId<Hint extends string = never>(
    attachmentId: string,
    { externalThreadId, populate }: { externalThreadId: string; populate?: Populate<Attachment, Hint> },
  ) {
    return orm.em.findOneOrFail(Attachment, { id: attachmentId, emailMessage: { externalThreadId } }, { populate });
  }
}
