import { db } from '../src/db.js';

async function check() {
  try {
    const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'User'");
    console.log('User Columns:', res.rows.map(r => r.column_name));
    
    const res2 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('users Columns:', res2.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    process.exit();
  }
}

check();
