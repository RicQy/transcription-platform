import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTables() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables found:', res.rows.map(r => r.table_name));
    process.exit(0);
  } catch (err) {
    console.error('Error checking tables:', err);
    process.exit(1);
  }
}

checkTables();
