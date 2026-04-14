import { db } from '../db.js';
import { extractTextFromUrl } from '../utils/file-extractor.js';
import Anthropic from '@anthropic-ai/sdk';
import { appCache } from '../lib/cache.js';
import { ServiceError } from '../errors/service-error.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

class StyleGuideService {
  async getGuides() {
    const result = await db.from('style_guides')
      .select('*')
      .order('created_at', { ascending: false }) as { data?: unknown[]; error?: { message: string } | null };

    if (result.error) {
      throw new ServiceError(500, `Failed to fetch style guides: ${result.error.message}`);
    }
    return result;
  }

  async createGuide(userId: string, name: string, jurisdiction?: string, source_url?: string, source_key?: string) {
    if (!userId || typeof userId !== 'string') {
      throw new ServiceError(400, 'userId is required and must be a string');
    }
    if (!name || typeof name !== 'string') {
      throw new ServiceError(400, 'Guide name is required and must be a string');
    }

    const { data: guide, error } = await db.from('style_guides').insert([{
      user_id: userId,
      name,
      jurisdiction,
      source_url,
      source_key,
      version: 1,
      is_published: false,
      is_active: true
    }]).select().single() as { data?: Record<string, unknown>; error?: { message: string } | null };

    if (error) {
      throw new ServiceError(500, `Failed to create style guide: ${error.message}`);
    }
    
    return guide;
  }

  async listRules(guideId: string) {
    if (!guideId || typeof guideId !== 'string') {
      throw new ServiceError(400, 'guideId is required and must be a string');
    }

    const cacheKey = `rules:${guideId}`;
    const cached = appCache.get(cacheKey);
    if (cached) return { data: cached };

    const { data: rules, error } = await db.from('style_guide_rules')
      .select('*')
      .eq('guide_id', guideId) as { data?: unknown[]; error?: { message: string } | null };

    if (error) {
      throw new ServiceError(500, `Failed to fetch rules: ${error.message}`);
    }
    
    if (rules) appCache.set(cacheKey, rules);
    return { data: rules };
  }

  async addRule(guideId: string, ruleType: string, ruleText: string) {
    if (!guideId || typeof guideId !== 'string') {
      throw new ServiceError(400, 'guideId is required and must be a string');
    }
    if (!ruleType || typeof ruleType !== 'string') {
      throw new ServiceError(400, 'ruleType is required and must be a string');
    }
    if (!ruleText || typeof ruleText !== 'string') {
      throw new ServiceError(400, 'ruleText is required and must be a string');
    }

    appCache.delete(`rules:${guideId}`);

    const result = await db.from('style_guide_rules').insert([{
      guide_id: guideId,
      rule_type: ruleType,
      rule_text: ruleText,
      is_active: true
    }]).select().single() as { data?: Record<string, unknown>; error?: { message: string } | null };

    if (result.error) {
      throw new ServiceError(500, `Failed to add rule: ${result.error.message}`);
    }
    return result;
  }

  /**
   * Versioning logic:
   * If a guide is already published or linked to transcripts, we create a CLONE as a new version.
   */
  async updateGuide(guideId: string, name: string) {
    if (!guideId || typeof guideId !== 'string') {
      throw new ServiceError(400, 'guideId is required and must be a string');
    }
    if (!name || typeof name !== 'string') {
      throw new ServiceError(400, 'Guide name is required and must be a string');
    }

    const { data: guide } = await db.from('style_guides').select('*').eq('id', guideId).single() as { data?: Record<string, unknown>; error?: { message: string } | null };
    if (!guide) throw new ServiceError(404, 'Style guide not found');

    // Check if used by any transcript
    const { data: transcripts } = await db.from('transcripts').select('id').eq('style_guide_id', guideId) as { data?: Record<string, unknown>[]; error?: { message: string } | null };
    
    if (guide.is_published || (transcripts && transcripts.length > 0)) {
      // Create new version
      const { data: newVersion, error: insertError } = await db.from('style_guides').insert([{
        user_id: guide.user_id,
        name: name,
        version: (guide.version as number) + 1,
        is_published: false,
        is_active: true
      }]).select().single() as { data?: Record<string, unknown>; error?: { message: string } | null };

      if (insertError || !newVersion) {
        throw new ServiceError(500, 'Failed to create new style guide version');
      }

      // Deactivate old one
      await db.from('style_guides').update({ is_active: false }).eq('id', guideId);

      // Clone rules
      const { data: rules } = await db.from('style_guide_rules').select('*').eq('guide_id', guideId) as { data?: Record<string, unknown>[]; error?: { message: string } | null };
      if (rules && rules.length > 0) {
        const clonedRules = rules.map((r: Record<string, unknown>) => ({
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
      const { data: updated, error: updateError } = await db.from('style_guides').update({ name }).eq('id', guideId).select().single() as { data?: Record<string, unknown>; error?: { message: string } | null };
      if (updateError) {
        throw new ServiceError(500, `Failed to update style guide: ${updateError.message}`);
      }
      return updated;
    }
  }

  async publishGuide(guideId: string) {
    if (!guideId || typeof guideId !== 'string') {
      throw new ServiceError(400, 'guideId is required and must be a string');
    }

    const result = await db.from('style_guides').update({ is_published: true }).eq('id', guideId) as { data?: unknown; error?: { message: string } | null };
    if (result.error) {
      throw new ServiceError(500, `Failed to publish style guide: ${result.error.message}`);
    }
    return result;
  }

  async ingestFromSource(guideId: string) {
    if (!guideId || typeof guideId !== 'string') {
      throw new ServiceError(400, 'guideId is required and must be a string');
    }

    const { data: guide } = await db.from('style_guides').select('*').eq('id', guideId).single() as { data?: Record<string, unknown>; error?: { message: string } | null };
    if (!guide) {
      throw new ServiceError(404, 'Style guide not found');
    }
    if (!guide.source_url || !guide.source_key) {
      throw new ServiceError(400, 'Guide source file not found — source_url and source_key are required');
    }

    let text: string;
    try {
      text = await extractTextFromUrl(guide.source_url as string, guide.source_key as string);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ServiceError(502, `Failed to extract text from source: ${message}`);
    }

    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ServiceError(502, `AI service request failed: ${message}`);
    }

    const contentBlock = response.content[0];
    if (!contentBlock || contentBlock.type !== 'text') {
      throw new ServiceError(502, 'AI service returned an unexpected response format');
    }

    let rules: Record<string, string>;
    try {
      rules = JSON.parse(contentBlock.text);
    } catch {
      throw new ServiceError(502, 'AI service returned invalid JSON');
    }

    // Clear existing rules for this guide if any
    await db.query('DELETE FROM style_guide_rules WHERE guide_id = $1', [guideId]);

    // Insert new rules
    const ruleEntries = Object.entries(rules).map(([type, ruleText]) => ({
      guide_id: guideId,
      rule_type: type,
      rule_text: ruleText as string,
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
