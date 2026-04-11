import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface DBResult<T = any> {
  data?: T;
  error?: { message: string } | null;
}

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  
  from: (table: string) => {
    return {
      select: (columns = '*') => {
        const filters: { col: string, val: any }[] = [];
        const orders: { col: string, dir: string }[] = [];
        const builder = {
          eq: (column: string, value: any) => {
            filters.push({ col: column, val: value });
            return builder;
          },
          order: (column: string, { ascending = true } = {}) => {
            orders.push({ col: column, dir: ascending ? 'ASC' : 'DESC' });
            return builder;
          },
          single: async (): Promise<DBResult> => {
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
          execute: async (): Promise<DBResult<any[]>> => {
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

      insert: (rows: any[]) => {
        const builder = {
          select: (columns = '*') => {
            return {
              single: async (): Promise<DBResult> => {
                const row = Array.isArray(rows) ? rows[0] : rows;
                const keys = Object.keys(row);
                const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${columns}`;
                const res = await pool.query(query, Object.values(row));
                return { data: res.rows[0], error: null };
              },
              execute: async (): Promise<DBResult<any[]>> => {
                const results = [];
                const rowsArray = Array.isArray(rows) ? rows : [rows];
                for (const row of rowsArray) {
                  const keys = Object.keys(row);
                  const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${columns}`;
                  const res = await pool.query(query, Object.values(row));
                  results.push(res.rows[0]);
                }
                return { data: results, error: null };
              }
            };
          },
          execute: async (): Promise<DBResult<any[]>> => {
            const results = [];
            const rowsArray = Array.isArray(rows) ? rows : [rows];
            for (const row of rowsArray) {
              const keys = Object.keys(row);
              const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`;
              await pool.query(query, Object.values(row));
            }
            return { data: [], error: null };
          }
        };
        return builder;
      },

      update: (values: any) => {
        const filters: { col: string, val: any }[] = [];
        const builder = {
          eq: (column: string, value: any) => {
            filters.push({ col: column, val: value });
            return builder;
          },
          select: (columns = '*') => {
            return {
              single: async (): Promise<DBResult> => {
                const keys = Object.keys(values);
                let query = `UPDATE ${table} SET ` + keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
                const params = Object.values(values);
                if (filters.length > 0) {
                  query += ' WHERE ' + filters.map((f, i) => `${f.col} = $${i + keys.length + 1}`).join(' AND ');
                  params.push(...filters.map(f => f.val));
                }
                query += ` RETURNING ${columns}`;
                const res = await pool.query(query, params);
                return { data: res.rows[0], error: null };
              }
            };
          },
          execute: async (): Promise<DBResult<any[]>> => {
            const keys = Object.keys(values);
            let query = `UPDATE ${table} SET ` + keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const params = Object.values(values);
            if (filters.length > 0) {
              query += ' WHERE ' + filters.map((f, i) => `${f.col} = $${i + keys.length + 1}`).join(' AND ');
              params.push(...filters.map(f => f.val));
            }
            const res = await pool.query(query, params);
            return { data: res.rows, error: null };
          }
        };
        return builder;
      }
    };
  }
};
