import { getApiUrl } from './config';

export interface EvaluationData {
  id: string;
  transcript_id: string;
  gold_standard_text: string;
  wer: number;
  cer: number;
  alignment_data: Array<{
    type: 'insertion' | 'deletion' | 'equal';
    value: string;
  }>;
  created_at: string;
}

export const evaluationApi = {
  async runEvaluation(id: string, goldStandardText: string): Promise<EvaluationData> {
    const token = localStorage.getItem('token');
    const response = await fetch(getApiUrl(`/transcripts/${id}/evaluate`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ goldStandardText })
    });

    if (!response.ok) throw new Error('Evaluation failed');
    return response.json();
  },

  async getLatestEvaluation(id: string): Promise<EvaluationData | null> {
    const token = localStorage.getItem('token');
    const response = await fetch(getApiUrl(`/transcripts/${id}/evaluation`), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) return null;
    return response.json();
  }
};
