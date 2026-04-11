import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  
  // Helper for Supabase-like syntax replacement
  from: (table: string) => ({
    select: (columns = '*') => {
      const builder = {
        eq: (column: string, value: any) => ({
          single: async () => {
            const res = await pool.query(`SELECT ${columns} FROM ${table} WHERE ${column} = $1 LIMIT 1`, [value]);
            return { data: res.rows[0], error: res.rows[0] ? null : { message: 'Not found' } };
          },
          execute: async () => {
            const res = await pool.query(`SELECT ${columns} FROM ${table} WHERE ${column} = $1`, [value]);
            return { data: res.rows, error: null };
          }
        }),
        single: async () => {
          const res = await pool.query(`SELECT ${columns} FROM ${table} LIMIT 1`);
          return { data: res.rows[0], error: res.rows[0] ? null : { message: 'Not found' } };
        },
        execute: async () => {
          const res = await pool.query(`SELECT ${columns} FROM ${table}`);
          return { data: res.rows, error: null };
        }
      };
      return builder;
    },
    
    update: (values: Record<string, any>) => ({
      eq: (column: string, value: any) => ({
        execute: async () => {
          const keys = Object.keys(values);
          const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
          const params = [...Object.values(values), value];
          const query = `UPDATE ${table} SET ${sets} WHERE ${column} = $${params.length}`;
          await pool.query(query, params);
          return { error: null };
        }
      })
    }),

    insert: (rows: any[]) => ({
      select: () => ({
        single: async () => {
          const row = rows[0];
          const keys = Object.keys(row);
          const cols = keys.join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const params = Object.values(row);
          const query = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
          const res = await pool.query(query, params);
          return { data: res.rows[0], error: res.rows[0] ? null : { message: 'Insert failed' } };
        }
      })
    })
  })
};
