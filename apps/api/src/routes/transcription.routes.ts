import { Router } from 'express';
import { transcriptionController } from '../controllers/transcription.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router: Router = Router();

router.post('/transcribe', authenticate, transcriptionController.transcribe);
router.get('/transcripts/:audioFileId', authenticate, transcriptionController.getTranscript);
router.patch('/transcripts/:id', authenticate, transcriptionController.updateTranscript);

export default router;
