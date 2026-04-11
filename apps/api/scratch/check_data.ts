import { db } from '../src/db.js';

async function check() {
  try {
    const res = await db.query("SELECT COUNT(*) FROM \"User\"");
    console.log('User count:', res.rows[0].count);
  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    process.exit();
  }
}

check();
