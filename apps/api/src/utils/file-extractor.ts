import * as pdfParse from 'pdf-parse';
const pdf = (pdfParse as any).default || pdfParse;
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function extractTextFromUrl(url: string, key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  const response = await s3.send(command);
  const stream = response.Body as any;
  
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  if (url.toLowerCase().endsWith('.pdf')) {
    const data = await pdf(buffer);
    return data.text;
  } else {
    // Assume text/plain
    return buffer.toString('utf-8');
  }
}
