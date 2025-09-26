"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const os_1 = __importDefault(require("os"));
const authInstance_1 = require("@/services/authInstance");
const db_1 = require("@/utils/db");
async function ensureAuth(req) {
    const auth = req.headers['authorization'];
    const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
    if (!token)
        throw new Error('UNAUTHORIZED');
    return await authInstance_1.authService.profile(token);
}
async function ensureAdminAuth(req) {
    const user = await ensureAuth(req);
    if (!user || user.role !== 'admin')
        throw new Error('UNAUTHORIZED');
    return user;
}
class AdminController {
    static async systemInfo(req, res) {
        try {
            await ensureAdminAuth(req);
            const memTotal = os_1.default.totalmem();
            const memFree = os_1.default.freemem();
            const memUsed = memTotal - memFree;
            const load = os_1.default.loadavg ? os_1.default.loadavg() : [0, 0, 0];
            const cpuCount = os_1.default.cpus()?.length || 0;
            const info = {
                platform: os_1.default.platform(),
                release: os_1.default.release(),
                arch: os_1.default.arch(),
                nodeVersion: process.version,
                uptimeSec: Math.floor(process.uptime()),
                memory: {
                    total: memTotal,
                    free: memFree,
                    used: memUsed,
                    rss: process.memoryUsage().rss,
                },
                cpu: {
                    count: cpuCount,
                    load1: load[0] || 0,
                    load5: load[1] || 0,
                    load15: load[2] || 0,
                }
            };
            return res.json({ data: info });
        }
        catch (e) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
        }
    }
    static async users(req, res) {
        try {
            await ensureAdminAuth(req);
            const data = await (0, db_1.withClient)(async (client) => {
                const { rows } = await client.query('SELECT id, username, role, status, created_at, updated_at FROM users ORDER BY id DESC');
                return rows;
            });
            return res.json({ data });
        }
        catch (e) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
        }
    }
    static async logs(req, res) {
        try {
            await ensureAdminAuth(req);
            const { level, start, end, page = '1', pageSize = '20' } = req.query;
            const conditions = [];
            const params = [];
            let idx = 1;
            if (level) {
                conditions.push(`level = $${idx++}`);
                params.push(level);
            }
            if (start) {
                conditions.push(`timestamp >= $${idx++}`);
                params.push(new Date(start));
            }
            if (end) {
                conditions.push(`timestamp <= $${idx++}`);
                params.push(new Date(end));
            }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const pg = await (0, db_1.withClient)(async (client) => {
                const { rows: totalRows } = await client.query(`SELECT COUNT(*)::int AS count FROM logs ${where}`, params);
                const total = totalRows[0]?.count || 0;
                const p = Math.max(1, parseInt(String(page), 10) || 1);
                const ps = Math.min(200, Math.max(1, parseInt(String(pageSize), 10) || 20));
                const offset = (p - 1) * ps;
                const { rows } = await client.query(`SELECT id, timestamp, level, message FROM logs ${where} ORDER BY timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, ps, offset]);
                return { rows, total, page: p, pageSize: ps };
            });
            return res.json({ data: pg.rows, total: pg.total, page: pg.page, pageSize: pg.pageSize });
        }
        catch (e) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
        }
    }
    static async logsExport(req, res) {
        try {
            await ensureAdminAuth(req);
            const { level, start, end } = req.query;
            const conditions = [];
            const params = [];
            let idx = 1;
            if (level) {
                conditions.push(`level = $${idx++}`);
                params.push(level);
            }
            if (start) {
                conditions.push(`timestamp >= $${idx++}`);
                params.push(new Date(start));
            }
            if (end) {
                conditions.push(`timestamp <= $${idx++}`);
                params.push(new Date(end));
            }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const rows = await (0, db_1.withClient)(async (client) => {
                const { rows } = await client.query(`SELECT id, timestamp, level, message FROM logs ${where} ORDER BY timestamp DESC LIMIT 50000`, params);
                return rows;
            });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
            const header = 'id,timestamp,level,message\n';
            const body = rows.map(r => `${r.id},${new Date(r.timestamp).toISOString()},${r.level},"${(r.message || '').replace(/"/g, '""')}"`).join('\n');
            return res.status(200).send(header + body);
        }
        catch (e) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
        }
    }
    static async createUser(req, res) {
        try {
            await ensureAdminAuth(req);
            const { username, password, role = 'user', status = 'active' } = req.body || {};
            if (!username || !password) {
                return res.status(400).json({ code: 'BAD_REQUEST', message: 'username/password 必填', timestamp: new Date().toISOString() });
            }
            const data = await (0, db_1.withClient)(async (client) => {
                const exists = await client.query('SELECT 1 FROM users WHERE username=$1 LIMIT 1', [username]);
                if (exists.rowCount && exists.rowCount > 0) {
                    throw new Error('USER_EXISTS');
                }
                const salt = '';
                const hash = '';
                try {
                    const { rows } = await client.query('INSERT INTO users(username, password_salt, password_hash, password_plain, role, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username, role, status, created_at, updated_at', [username, salt, hash, password, role, status]);
                    return rows[0];
                }
                catch (e) {
                    const { rows } = await client.query('INSERT INTO users(username, password_salt, password_hash, role, status) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, role, status, created_at, updated_at', [username, salt, hash, role, status]);
                    return rows[0];
                }
            });
            return res.json({ data });
        }
        catch (e) {
            if (e?.message === 'USER_EXISTS') {
                return res.status(400).json({ code: 'USER_EXISTS', message: '用户名已存在', timestamp: new Date().toISOString() });
            }
            return res.status(500).json({ code: 'INTERNAL_ERROR', message: '创建用户失败', timestamp: new Date().toISOString() });
        }
    }
    static async updateUser(req, res) {
        try {
            await ensureAdminAuth(req);
            const { id, role, status } = req.body || {};
            if (!id)
                return res.status(400).json({ code: 'BAD_REQUEST', message: 'id 必填', timestamp: new Date().toISOString() });
            const fields = [];
            const params = [];
            let idx = 1;
            if (typeof role === 'string') {
                fields.push(`role=$${idx++}`);
                params.push(role);
            }
            if (typeof status === 'string') {
                fields.push(`status=$${idx++}`);
                params.push(status);
            }
            fields.push(`updated_at=NOW()`);
            const sql = `UPDATE users SET ${fields.join(', ')} WHERE id=$${idx} RETURNING id, username, role, status, created_at, updated_at`;
            params.push(id);
            const data = await (0, db_1.withClient)(async (client) => {
                const { rows } = await client.query(sql, params);
                return rows[0];
            });
            return res.json({ data });
        }
        catch (e) {
            return res.status(500).json({ code: 'INTERNAL_ERROR', message: '更新用户失败', timestamp: new Date().toISOString() });
        }
    }
    static async resetUserPassword(req, res) {
        try {
            await ensureAdminAuth(req);
            const { id, newPassword } = req.body || {};
            if (!id)
                return res.status(400).json({ code: 'BAD_REQUEST', message: 'id 必填', timestamp: new Date().toISOString() });
            const pwd = typeof newPassword === 'string' && newPassword.length >= 6
                ? newPassword
                : Math.random().toString(36).slice(-10);
            await (0, db_1.withClient)(async (client) => {
                try {
                    await client.query('UPDATE users SET password_plain=$1, updated_at=NOW() WHERE id=$2', [pwd, id]);
                }
                catch (e) {
                    await client.query('UPDATE users SET updated_at=NOW() WHERE id=$1', [id]);
                }
            });
            return res.json({ ok: true, newPassword: pwd });
        }
        catch (e) {
            return res.status(500).json({ code: 'INTERNAL_ERROR', message: '重置密码失败', timestamp: new Date().toISOString() });
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=AdminController.js.map