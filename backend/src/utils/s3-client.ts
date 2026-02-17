import { S3Client as AwsS3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '@/utils/env';

export class S3Client {
  static async uploadFile({ key, buffer, contentType }: { key: string; buffer: Buffer; contentType: string }) {
    const client = S3Client.getClient();
    await client.send(
      new PutObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key, Body: buffer, ContentType: contentType }),
    );
  }

  static async getFile({ key }: { key: string }) {
    const client = S3Client.getClient();
    const response = await client.send(new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key }));

    const chunks: Uint8Array[] = [];
    if (response.Body) {
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks);
  }

  static async deleteFile({ key }: { key: string }) {
    const client = S3Client.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key }));
  }

  static async deleteFiles({ keys }: { keys: string[] }) {
    await Promise.all(keys.map((key) => S3Client.deleteFile({ key })));
  }

  // -------------------------------------------------------------------------------------------------------------------

  private static client: AwsS3Client | null = null;

  private static getClient() {
    if (!S3Client.client) {
      S3Client.client = new AwsS3Client({
        region: ENV.S3_REGION,
        endpoint: ENV.S3_ENDPOINT,
        credentials: { accessKeyId: ENV.S3_ACCESS_KEY_ID, secretAccessKey: ENV.S3_SECRET_ACCESS_KEY },
        forcePathStyle: ENV.S3_FORCE_PATH_STYLE,
      });
    }
    return S3Client.client;
  }
}
