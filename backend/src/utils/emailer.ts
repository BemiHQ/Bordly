import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ENV } from '@/utils/env';

export const NO_REPLY_EMAIL = `Bordly <no-reply@${ENV.ROOT_DOMAIN}>`;

export class Emailer {
  static send({ from, to, subject, bodyText }: { from: string; to: string[]; subject: string; bodyText: string }) {
    console.log(
      [
        '[SES] Sending email:',
        `From: ${from}`,
        `To: ${to.join(', ')}`,
        `Subject: ${subject}`,
        `Body: ${bodyText}`,
      ].join('\n'),
    );

    if (!ENV.AWS_REGION || !ENV.AWS_SES_ACCESS_KEY_ID || !ENV.AWS_SES_SECRET_ACCESS_KEY) {
      return;
    }

    const client = new SESv2Client({
      region: ENV.AWS_REGION as string,
      credentials: {
        accessKeyId: ENV.AWS_SES_ACCESS_KEY_ID as string,
        secretAccessKey: ENV.AWS_SES_SECRET_ACCESS_KEY as string,
      },
    });
    const command = new SendEmailCommand({
      FromEmailAddress: from,
      Destination: {
        ToAddresses: to,
      },
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: {
            Text: { Data: bodyText },
          },
        },
      },
    });
    return client.send(command);
  }
}
