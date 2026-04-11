import { db } from '../db.js';

class StyleGuideService {
  async getGuides() {
    return await db.from('style_guides')
      .select('*')
      .order('created_at', { ascending: false })
      .execute();
  }

  async createGuide(userId: string, name: string) {
    const { data: guide } = await db.from('style_guides').insert([{
      user_id: userId,
      name,
      version: 1,
      is_published: false,
      is_active: true
    }]).select().single() as any;
    
    return guide;
  }

  async listRules(guideId: string) {
    return await db.from('style_guide_rules')
      .select('*')
      .eq('guide_id', guideId)
      .execute();
  }

  async addRule(guideId: string, ruleType: string, ruleText: string) {
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
    const { data: transcripts } = await db.from('transcripts').select('id').eq('style_guide_id', guideId).execute() as any;
    
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
      await db.from('style_guides').update({ is_active: false }).eq('id', guideId).execute();

      // Clone rules
      const { data: rules } = await db.from('style_guide_rules').select('*').eq('guide_id', guideId).execute() as any;
      if (rules?.length > 0) {
        const clonedRules = rules.map((r: any) => ({
          guide_id: newVersion.id,
          rule_type: r.rule_type,
          rule_text: r.rule_text,
          is_active: r.is_active
        }));
        await db.from('style_guide_rules').insert(clonedRules).execute();
      }

      return newVersion;
    } else {
      // Simple update
      const { data: updated } = await db.from('style_guides').update({ name }).eq('id', guideId).select().single() as any;
      return updated;
    }
  }

  async publishGuide(guideId: string) {
    return await db.from('style_guides').update({ is_published: true }).eq('id', guideId).execute();
  }
}

export const styleGuideService = new StyleGuideService();
