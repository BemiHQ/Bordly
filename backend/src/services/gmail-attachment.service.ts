import type { Loaded, Populate } from '@mikro-orm/postgresql';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi } from '@/utils/gmail-api';
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

  static async getAttachmentDataBuffer(
    gmailAttachment: Loaded<GmailAttachment, 'emailMessage.gmailAccount'>,
  ): Promise<Buffer> {
    const gmailAccount = gmailAttachment.loadedEmailMessage.loadedGmailAccount;
    const gmail = await GmailAccountService.initGmail(gmailAccount);

    const { data: attachmentData } = await GmailApi.getAttachment(gmail, {
      messageId: gmailAttachment.loadedEmailMessage.externalId,
      externalAttachmentId: gmailAttachment.externalId,
    });

    if (!attachmentData) {
      throw new Error('No attachment data returned from Gmail API');
    }

    return Buffer.from(attachmentData, 'base64url');
  }
}
