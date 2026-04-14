import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { audioController } from '../controllers/audio.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router: Router = Router();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Sanitize filename to prevent path traversal
function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4',
  'audio/ogg', 'audio/flac', 'audio/webm', 'audio/aac',
  'audio/x-m4a', 'video/mp4',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_AUDIO_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Only audio files are accepted.`));
    }
  }
});

router.get('/audio-files', authenticate, audioController.getFiles);
router.get('/audio/upload-url', authenticate, audioController.getUploadUrl);
router.post('/audio/register', authenticate, audioController.registerR2File);
router.post('/upload', authenticate, upload.single('file'), audioController.upload);

export default router;
