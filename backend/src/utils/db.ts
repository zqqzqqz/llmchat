import { Pool } from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        provider TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        api_key TEXT NOT NULL,
        app_id TEXT,
        model TEXT NOT NULL,
        max_tokens INTEGER,
        temperature REAL,
        system_prompt TEXT,
        capabilities JSONB DEFAULT '[]'::jsonb,
        rate_limit JSONB,
        features JSONB,
        metadata JSONB,
        is_active BOOLEAN DEFAULT true,
        source TEXT DEFAULT 'db',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
        title TEXT,
        user_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
        ON chat_messages (session_id, created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_configs_provider
        ON agent_configs (provider);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_configs_app
        ON agent_configs (app_id)
        WHERE app_id IS NOT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_geo_events (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
        session_id TEXT,
        ip TEXT,
        country TEXT,
        province TEXT,
        city TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_geo_events_created
        ON chat_geo_events (created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_geo_events_agent
        ON chat_geo_events (agent_id, created_at);
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

  await seedAgentsFromFile();
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

async function seedAgentsFromFile(): Promise<void> {
  const filePathCandidates = [
    path.resolve(__dirname, '../../config/agents.json'),
    path.resolve(process.cwd(), 'config/agents.json')
  ];

  let fileContent: string | null = null;
  for (const filePath of filePathCandidates) {
    try {
      if (fs.existsSync(filePath)) {
        fileContent = fs.readFileSync(filePath, 'utf-8');
        break;
      }
    } catch (e) {
      console.warn('[initDB] 读取智能体配置文件失败:', e);
    }
  }

  if (!fileContent) {
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (e) {
    console.warn('[initDB] 解析 agents.json 失败:', e);
    return;
  }

  const agents: any[] = Array.isArray(parsed?.agents) ? parsed.agents : [];
  if (agents.length === 0) {
    return;
  }

  await withClient(async (client) => {
    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM agent_configs');
    const count = parseInt(rows[0]?.count || '0', 10);
    if (count > 0) {
      return;
    }

    const insertText = `
      INSERT INTO agent_configs (
        id, name, description, provider, endpoint, api_key, app_id, model,
        max_tokens, temperature, system_prompt, capabilities, rate_limit,
        features, metadata, is_active, source
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12::jsonb,$13::jsonb,
        $14::jsonb,$15::jsonb,$16,$17
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        provider = EXCLUDED.provider,
        endpoint = EXCLUDED.endpoint,
        api_key = EXCLUDED.api_key,
        app_id = EXCLUDED.app_id,
        model = EXCLUDED.model,
        max_tokens = EXCLUDED.max_tokens,
        temperature = EXCLUDED.temperature,
        system_prompt = EXCLUDED.system_prompt,
        capabilities = EXCLUDED.capabilities,
        rate_limit = EXCLUDED.rate_limit,
        features = EXCLUDED.features,
        metadata = EXCLUDED.metadata,
        is_active = EXCLUDED.is_active,
        source = 'json',
        updated_at = NOW();
    `;

    for (const agent of agents) {
      try {
        await client.query(insertText, [
          agent.id,
          agent.name,
          agent.description ?? '',
          agent.provider,
          agent.endpoint,
          agent.apiKey,
          agent.appId ?? null,
          agent.model,
          agent.maxTokens ?? null,
          agent.temperature ?? null,
          agent.systemPrompt ?? null,
          JSON.stringify(agent.capabilities ?? []),
          JSON.stringify(agent.rateLimit ?? null),
          JSON.stringify(agent.features ?? null),
          JSON.stringify({ source: 'json' }),
          agent.isActive ?? true,
          'json',
        ]);
      } catch (e) {
        console.warn('[initDB] 导入智能体失败:', agent?.id, e);
      }
    }
  });
}

