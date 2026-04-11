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
      const filters: { col: string, val: any }[] = [];
      const orders: { col: string, dir: 'ASC' | 'DESC' }[] = [];
      const builder = {
        eq: (column: string, value: any) => {
          filters.push({ col: column, val: value });
          return builder;
        },
        order: (column: string, { ascending = true } = {}) => {
          orders.push({ col: column, dir: ascending ? 'ASC' : 'DESC' });
          return builder;
        },
        single: async () => {
          let query = `SELECT ${columns} FROM ${table}`;
          const params: any[] = [];
          if (filters.length > 0) {
            query += ' WHERE ' + filters.map((f, i) => `${f.col} = $${i + 1}`).join(' AND ');
            params.push(...filters.map(f => f.val));
          }
          if (orders.length > 0) {
            query += ' ORDER BY ' + orders.map(o => `${o.col} ${o.dir}`).join(', ');
          }
          query += ' LIMIT 1';
          const res = await pool.query(query, params);
          return { data: res.rows[0], error: res.rows[0] ? null : { message: 'Not found' } };
        },
        execute: async () => {
          let query = `SELECT ${columns} FROM ${table}`;
          const params: any[] = [];
          if (filters.length > 0) {
            query += ' WHERE ' + filters.map((f, i) => `${f.col} = $${i + 1}`).join(' AND ');
            params.push(...filters.map(f => f.val));
          }
          if (orders.length > 0) {
            query += ' ORDER BY ' + orders.map(o => `${o.col} ${o.dir}`).join(', ');
          }
          const res = await pool.query(query, params);
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
