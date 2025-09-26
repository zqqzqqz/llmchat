"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const os_1 = __importDefault(require("os"));
const AuthService_1 = require("@/services/AuthService");
const db_1 = require("@/utils/db");
const authService = new AuthService_1.AuthService();
async function ensureAuth(req) {
    const auth = req.headers['authorization'];
    const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
    if (!token)
        throw new Error('UNAUTHORIZED');
    return await authService.profile(token);
}
class AdminController {
    static async systemInfo(req, res) {
        try {
            await ensureAuth(req);
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
            await ensureAuth(req);
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
            await ensureAuth(req);
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
            const data = await (0, db_1.withClient)(async (client) => {
                const { rows } = await client.query(`SELECT id, timestamp, level, message FROM logs ${where} ORDER BY timestamp DESC LIMIT 1000`, params);
                return rows;
            });
            return res.json({ data });
        }
        catch (e) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
        }
    }
    static async logsExport(req, res) {
        try {
            await ensureAuth(req);
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
}
exports.AdminController = AdminController;
//# sourceMappingURL=AdminController.js.map