#!/usr/bin/env node

import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { ENV } from '@/utils/env';

const bucketName = ENV.S3_BUCKET;
const client = new S3Client({
  region: ENV.S3_REGION,
  endpoint: ENV.S3_ENDPOINT,
  credentials: { accessKeyId: ENV.S3_ACCESS_KEY_ID, secretAccessKey: ENV.S3_SECRET_ACCESS_KEY },
  forcePathStyle: ENV.S3_FORCE_PATH_STYLE,
});

async function initBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`✓ Bucket '${bucketName}' already exists`);
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode: number } }).$metadata?.httpStatusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`✓ Created bucket '${bucketName}'`);
    } else {
      throw error;
    }
  }
}

initBucket().catch((error) => {
  console.error('Failed to initialize MinIO bucket:', error);
  process.exit(1);
});
