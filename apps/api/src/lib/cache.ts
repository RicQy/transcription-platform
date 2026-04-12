/**
 * Minimal in-memory cache for legal transcription system performance.
 * Specifically used for style guide rules to avoid DB pressure during large batch exports.
 */

class SimpleCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();
  private defaultTTL = 1000 * 60 * 5; // 5 minutes

  set(key: string, data: T, ttlMs?: number) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttlMs || this.defaultTTL)
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

export const appCache = new SimpleCache<any>();
