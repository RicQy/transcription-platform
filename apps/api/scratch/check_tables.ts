import { db } from '../src/db.js';

async function check() {
  try {
    const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    process.exit();
  }
}

check();
