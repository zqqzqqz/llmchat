"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.initDB = initDB;
exports.withClient = withClient;
exports.hashPassword = hashPassword;
exports.closeDB = closeDB;
const pg_1 = require("pg");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("@/utils/config");
let pool = null;
function getPool() {
    if (!pool) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    return pool;
}
async function initDB() {
    const cfg = await (0, config_1.readJsonc)('config/config.jsonc');
    const pg = cfg.database?.postgres;
    if (!pg) {
        throw new Error('DATABASE_CONFIG_MISSING');
    }
    pool = new pg_1.Pool({
        host: pg.host,
        port: pg.port ?? 5432,
        user: pg.user,
        password: pg.password,
        database: pg.database,
        ssl: pg.ssl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
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
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;`);
        await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        level TEXT NOT NULL,
        message TEXT NOT NULL
      );
    `);
        const { rows } = await client.query(`SELECT COUNT(*)::text AS count FROM users`);
        const count = parseInt(rows[0]?.count || '0', 10);
        if (count === 0) {
            await client.query(`INSERT INTO users(username, password_salt, password_hash, password_plain, role, status) VALUES ($1,$2,$3,$4,$5,$6)`, ['admin', '', '', 'admin', 'admin', 'active']);
        }
    });
}
async function withClient(fn) {
    const p = getPool();
    const client = await p.connect();
    try {
        return await fn(client);
    }
    finally {
        client.release();
    }
}
function hashPassword(password, salt) {
    const realSalt = salt || crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default.createHash('sha256').update(`${realSalt}:${password}`).digest('hex');
    return { salt: realSalt, hash };
}
async function closeDB() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
//# sourceMappingURL=db.js.map