import { db } from '../db.js';

class StyleGuideService {
  async getGuides() {
    const { data } = await db.from('style_guides').select('*').execute() as any;
    return data;
  }

  async createGuide(version: string, storageUrl: string) {
    const { data: guide } = await db.from('style_guides').insert([{
      version,
      storage_url: storageUrl,
      is_active: true
    }]).select().single() as any;
    
    return guide;
  }
}

export const styleGuideService = new StyleGuideService();
