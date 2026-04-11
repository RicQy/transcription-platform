import { db } from '../src/db.js';

async function migrate() {
  try {
    console.log('Running migration: ALTER TABLE audio_files ADD COLUMN storage_key TEXT');
    await db.query('ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS storage_key TEXT');
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();
