import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { styleGuideController } from '../controllers/style-guide.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router: Router = Router();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.get('/style-guides', authenticate, styleGuideController.getGuides);
router.post('/style-guides', authenticate, upload.single('file'), styleGuideController.upload);

export default router;
