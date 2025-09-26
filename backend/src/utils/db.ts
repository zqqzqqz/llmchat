import { Pool } from 'pg';
import crypto from 'crypto';
import { readJsonc } from '@/utils/config';

export interface PgConfig {
  database?: {
    postgres?: {
      host: string;
      port?: number;
      user: string;
      password: string;
      database: string;
      ssl?: boolean;
    }
  };
  auth?: {
    tokenTTLSeconds?: number;
  };
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    throw new Error('DB_NOT_INITIALIZED');
  }
  return pool;
}

export async function initDB(): Promise<void> {
  const cfg = await readJsonc<PgConfig>('config/config.jsonc');
  const pg = cfg.database?.postgres;
  if (!pg) {
    throw new Error('DATABASE_CONFIG_MISSING');
  }
  pool = new Pool({
    host: pg.host,
    port: pg.port ?? 5432,
    user: pg.user,
    password: pg.password,
    database: pg.database,
    ssl: pg.ssl ? { rejectUnauthorized: false } as any : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // 建表（若不存在）
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 明文密码列（若不存在则添加）
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        level TEXT NOT NULL,
        message TEXT NOT NULL
      );
    `);

    // 首次空库自动种子管理员（仅非生产环境）——按明文存储
    const { rows } = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`);
    const count = parseInt(rows[0]?.count || '0', 10);
    if (count === 0) {
      await client.query(
        `INSERT INTO users(username, password_salt, password_hash, password_plain, role, status) VALUES ($1,$2,$3,$4,$5,$6)`,
        ['admin', '', '', 'admin', 'admin', 'active']
      );
    }
  });
}

export async function withClient<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const realSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(`${realSalt}:${password}`).digest('hex');
  return { salt: realSalt, hash };
}

export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

