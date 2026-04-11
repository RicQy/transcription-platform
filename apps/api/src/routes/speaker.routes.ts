import { Router } from 'express';
import { speakerController } from '../controllers/speaker.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router: Router = Router();

router.get('/speakers', authenticate, speakerController.getMySpeakers);
router.post('/speakers', authenticate, speakerController.createSpeaker);

router.get('/audio-files/:audioFileId/speakers', authenticate, speakerController.indexAudioFileSpeakers);
router.post('/audio-files/:audioFileId/speakers', authenticate, speakerController.updateAudioFileSpeakerLink);

export default router;
