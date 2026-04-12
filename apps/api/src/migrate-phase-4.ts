import { db } from './db.js';

async function migrate() {
  console.log('Running migrations for Phase 4...');
  try {
    await db.query(`
      ALTER TABLE style_guides 
      ADD COLUMN IF NOT EXISTS jurisdiction TEXT,
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS source_key TEXT;
    `);
    console.log('Migrations complete!');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    process.exit(0);
  }
}

migrate();
