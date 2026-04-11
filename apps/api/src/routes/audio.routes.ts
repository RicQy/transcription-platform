import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { audioController } from '../controllers/audio.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router: Router = Router();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get('/audio-files', authenticate, audioController.getFiles);
router.get('/audio/upload-url', authenticate, audioController.getUploadUrl);
router.post('/audio/register', authenticate, audioController.registerR2File);
router.post('/upload', authenticate, upload.single('file'), audioController.upload);

export default router;
