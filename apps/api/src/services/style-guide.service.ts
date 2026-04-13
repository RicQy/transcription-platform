import { db } from '../db.js';
import { extractTextFromUrl } from '../utils/file-extractor.js';
import Anthropic from '@anthropic-ai/sdk';
import { appCache } from '../lib/cache.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

class StyleGuideService {
  async getGuides() {
    return await db.from('style_guides')
      .select('*')
      .order('created_at', { ascending: false })
      ;
  }

  async createGuide(userId: string, name: string, jurisdiction?: string, source_url?: string, source_key?: string) {
    const { data: guide } = await db.from('style_guides').insert([{
      user_id: userId,
      name,
      jurisdiction,
      source_url,
      source_key,
      version: 1,
      is_published: false,
      is_active: true
    }]).select().single() as any;
    
    return guide;
  }

  async listRules(guideId: string) {
    const cacheKey = `rules:${guideId}`;
    const cached = appCache.get(cacheKey);
    if (cached) return { data: cached };

    const { data: rules } = await db.from('style_guide_rules')
      .select('*')
      .eq('guide_id', guideId)
       as any;
    
    if (rules) appCache.set(cacheKey, rules);
    return { data: rules };
  }

  async addRule(guideId: string, ruleType: string, ruleText: string) {
    appCache.delete(`rules:${guideId}`);
    return await db.from('style_guide_rules').insert([{
      guide_id: guideId,
      rule_type: ruleType,
      rule_text: ruleText,
      is_active: true
    }]).select().single();
  }

  /**
   * Versioning logic:
   * If a guide is already published or linked to transcripts, we create a CLONE as a new version.
   */
  async updateGuide(guideId: string, name: string) {
    const { data: guide } = await db.from('style_guides').select('*').eq('id', guideId).single() as any;
    if (!guide) throw new Error('Style guide not found');

    // Check if used by any transcript
    const { data: transcripts } = await db.from('transcripts').select('id').eq('style_guide_id', guideId) as any;
    
    if (guide.is_published || transcripts?.length > 0) {
      // Create new version
      const { data: newVersion } = await db.from('style_guides').insert([{
        user_id: guide.user_id,
        name: name,
        version: guide.version + 1,
        is_published: false,
        is_active: true
      }]).select().single() as any;

      // Deactivate old one
      await db.from('style_guides').update({ is_active: false }).eq('id', guideId);

      // Clone rules
      const { data: rules } = await db.from('style_guide_rules').select('*').eq('guide_id', guideId) as any;
      if (rules?.length > 0) {
        const clonedRules = rules.map((r: any) => ({
          guide_id: newVersion.id,
          rule_type: r.rule_type,
          rule_text: r.rule_text,
          is_active: r.is_active
        }));
        await db.from('style_guide_rules').insert(clonedRules);
      }

      return newVersion;
    } else {
      // Simple update
      const { data: updated } = await db.from('style_guides').update({ name }).eq('id', guideId).select().single() as any;
      return updated;
    }
  }

  async publishGuide(guideId: string) {
    return await db.from('style_guides').update({ is_published: true }).eq('id', guideId);
  }

  async ingestFromSource(guideId: string) {
    const { data: guide } = await db.from('style_guides').select('*').eq('id', guideId).single() as any;
    if (!guide || !guide.source_url || !guide.source_key) {
      throw new Error('Guide source file not found');
    }

    const text = await extractTextFromUrl(guide.source_url, guide.source_key);
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: `You are an expert legal transcription auditor. Your task is to extract Clean Verbatim Legal (CVL) formatting rules from a courtroom style manual.
      
      You must produce a JSON object with the following keys:
      - filler-removal: Rules for words like 'um', 'uh', 'you know'.
      - slang-normalization: Rules for normalizing 'gonna', 'wanna', etc.
      - false-starts: How to handle stuttering or restarted sentences.
      - punctuation: Specific rules for dashes, ellipses, and commas in court transcripts.
      - tags: Rules for in-audible or background noise tags (e.g., [inaudible], [crosstalk]).
      - speaker-labels: Rules for naming conventions (e.g., THE COURT:, MR. SMITH:).
      - capitalization: Specific legal capitalization rules (e.g., 'Plaintiff', 'Defendant').
      
      Return ONLY valid JSON.`,
      messages: [
        { role: 'user', content: `Extract core CVL rules from this legal manual:\n\n${text.substring(0, 50000)}` }
      ]
    });

    const content = (response.content[0] as any).text;
    const rules = JSON.parse(content);

    // Clear existing rules for this guide if any
    await db.query('DELETE FROM style_guide_rules WHERE guide_id = $1', [guideId]);

    // Insert new rules
    const ruleEntries = Object.entries(rules).map(([type, text]) => ({
      guide_id: guideId,
      rule_type: type,
      rule_text: text as string,
      is_active: true
    }));

    if (ruleEntries.length > 0) {
      await db.from('style_guide_rules').insert(ruleEntries);
      appCache.delete(`rules:${guideId}`);
    }

    return { success: true, count: ruleEntries.length };
  }
}

export const styleGuideService = new StyleGuideService();
