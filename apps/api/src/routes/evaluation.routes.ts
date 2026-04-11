import { Router } from 'express';
import { evaluationController } from '../controllers/evaluation.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router: Router = Router();

router.post('/transcripts/:id/evaluate', authenticate, evaluationController.evaluate);
router.get('/transcripts/:id/evaluation', authenticate, evaluationController.getLatestEvaluation);

export default router;
