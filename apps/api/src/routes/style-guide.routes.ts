import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { styleGuideController } from '../controllers/style-guide.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router: Router = Router();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Sanitize filename to prevent path traversal
function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max for style guide documents
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOC_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Only PDF, TXT, and DOCX files are accepted.`));
    }
  }
});

router.get('/style-guides', authenticate, styleGuideController.getGuides);
router.post('/style-guides', authenticate, upload.single('file'), styleGuideController.upload);
router.post('/style-guides/:id/ingest', authenticate, styleGuideController.ingest);

export default router;
