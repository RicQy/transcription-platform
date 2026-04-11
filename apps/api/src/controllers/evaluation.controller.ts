import { Request, Response } from 'express';
import { evaluationService } from '../services/evaluation.service.js';

class EvaluationController {
  async evaluate(req: Request, res: Response) {
    const { id } = req.params;
    const { goldStandardText } = req.body;

    if (!goldStandardText) {
      return res.status(400).json({ error: 'goldStandardText is required' });
    }

    try {
      const result = await evaluationService.evaluateTranscript(id, goldStandardText);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getLatestEvaluation(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const { data } = await db.from('evaluations')
        .select('*')
        .eq('transcript_id', id)
        .order('created_at', { ascending: false })
        .single() as any;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

// Import db for the helper call
import { db } from '../db.js';

export const evaluationController = new EvaluationController();
