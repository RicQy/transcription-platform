import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  const dbName = 'transcribe';
  
  // 1. Connect to default postgres to create the database if missing
  const rootUrl = connectionString.replace(`/${dbName}`, '/postgres');
  const rootPool = new pg.Pool({ connectionString: rootUrl });
  
  try {
    await rootPool.query(`CREATE DATABASE ${dbName}`);
    console.log(`Database ${dbName} created.`);
  } catch (err: any) {
    if (err.code === '42P04') {
      console.log(`Database ${dbName} already exists.`);
    } else {
      console.error('Failed to create database:', err.message);
    }
  } finally {
    await rootPool.end();
  }

  // 2. Run schema.sql
  const pool = new pg.Pool({ connectionString });
  try {
    const schemaPath = 'apps/api/src/schema.sql';
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Schema applied successfully.');
  } catch (err: any) {
    console.error('Failed to apply schema:', err.message);
  } finally {
    await pool.end();
  }
}

initDb();
