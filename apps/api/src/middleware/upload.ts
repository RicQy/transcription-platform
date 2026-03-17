import multer from 'multer';
import { RequestHandler } from 'express';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

export const ACCEPTED_AUDIO_EXTENSIONS = new Set(['.mp3', '.mp4', '.wav', '.m4a', '.flac']);
export const ACCEPTED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/m4a',
  'audio/flac',
  'audio/x-flac',
  'video/mp4',
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(env.FILE_STORAGE_PATH, 'audio');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, unique);
  },
});

export const audioUpload: RequestHandler = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('audio');

export function isAcceptedAudioFile(file: Express.Multer.File): boolean {
  const ext = path.extname(file.originalname).toLowerCase();
  return ACCEPTED_AUDIO_MIME_TYPES.has(file.mimetype) || ACCEPTED_AUDIO_EXTENSIONS.has(ext);
}
