import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const R2_ENDPOINT = process.env.STORAGE_ENDPOINT || '';
const R2_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.STORAGE_BUCKET || 'transcribe-audio';
const REGION = process.env.STORAGE_REGION || 'auto';

const s3Client = new S3Client({
  region: REGION,
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export class StorageService {
  /**
   * Generates a pre-signed URL for uploading a file directly to R2.
   * @param key The destination key (filename) in the bucket.
   * @param contentType The expected MIME type of the file.
   * @param expiresIn Expiration time in seconds (default 15 mins).
   */
  async getPreSignedUploadUrl(key: string, contentType: string, expiresIn: number = 900): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Generates a pre-signed URL for downloading/viewing a file from R2.
   */
  async getPreSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  getBucketName() {
    return BUCKET_NAME;
  }
  
  getPublicUrl(key: string) {
    // Note: This relies on whether the bucket was configured for public access or custom domain
    // For R2, it's often https://<bucket>.<account-id>.r2.cloudflarestorage.com/<key>
    // But we prefer pre-signed URLs for security.
    return `${R2_ENDPOINT}/${BUCKET_NAME}/${key}`;
  }
}

export const storageService = new StorageService();
export { s3Client };
