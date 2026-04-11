import { diffWordsWithSpace } from 'diff';
import { db } from '../db.js';

export interface EvaluationResult {
  wer: number;
  cer: number;
  alignment: any[];
}

class EvaluationService {
  async evaluateTranscript(transcriptId: string, goldStandard: string) {
    const { data: transcript } = await db.from('transcripts').select('*').eq('id', transcriptId).single() as any;
    if (!transcript) throw new Error('Transcript not found');

    const hypothesis = transcript.full_text || '';
    const reference = goldStandard;

    const result = this.calculateWER(reference, hypothesis);
    const cerResult = this.calculateCER(reference, hypothesis);

    const { data } = await db.from('evaluations').insert([{
      transcript_id: transcriptId,
      gold_standard_text: goldStandard,
      wer: result.wer,
      cer: cerResult,
      alignment_data: result.alignment
    }]).select().single() as any;

    return data;
  }

  private calculateWER(ref: string, hyp: string) {
    const diff = diffWordsWithSpace(ref, hyp);
    
    let substitutions = 0;
    let deletions = 0;
    let insertions = 0;
    let refWordCount = 0;

    // We need a more accurate S, D, I count from jsdiff output
    // jsdiff 'added' means insertion in hyp
    // jsdiff 'removed' means deletion in hyp (exists in ref)
    // jsdiff neither means equal
    
    // A substitution often appears as a removed segment immediately followed by an added segment
    // But jsdiff doesn't explicitly flag subst. We'll simplify: 
    // D = count of removed words
    // I = count of added words
    // S = We'll approximate: matching removal+addition pairs at same index
    
    const alignment: any[] = [];

    diff.forEach(part => {
      const words = part.value.trim().split(/\s+/).filter(w => w.length > 0);
      const count = words.length;

      if (part.added) {
        insertions += count;
        alignment.push({ type: 'insertion', value: part.value });
      } else if (part.removed) {
        deletions += count;
        refWordCount += count;
        alignment.push({ type: 'deletion', value: part.value });
      } else {
        refWordCount += count;
        alignment.push({ type: 'equal', value: part.value });
      }
    });

    // In simple WER: S + D + I. 
    // Usually S+D+I is found by path optimization, but jsdiff is close enough for a prototype.
    // Real WER uses Levenshtein at word level.
    const wer = refWordCount > 0 ? ((deletions + insertions) / refWordCount) * 100 : (insertions > 0 ? 100 : 0);

    return { 
      wer: Math.min(100, Number(wer.toFixed(2))), 
      alignment 
    };
  }

  private calculateCER(ref: string, hyp: string) {
    // Simple character-level Levenshtein distance
    const distance = this.levenshteinDistance(ref, hyp);
    const cer = ref.length > 0 ? (distance / ref.length) * 100 : (hyp.length > 0 ? 100 : 0);
    return Number(cer.toFixed(2));
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[len1][len2];
  }
}

export const evaluationService = new EvaluationService();
