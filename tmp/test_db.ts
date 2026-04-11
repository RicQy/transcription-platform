import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Postgres Connected successfully:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Postgres Connection Failed:', err);
    process.exit(1);
  }
}

testConnection();
