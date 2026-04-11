import { db } from '../src/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../src/schema.sql'), 'utf-8');
    console.log('Running schema.sql...');
    await db.query(sql);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Initialization failed:', err);
  } finally {
    process.exit();
  }
}

init();
