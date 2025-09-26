"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const config_1 = require("@/utils/config");
const helpers_1 = require("@/utils/helpers");
const db_1 = require("@/utils/db");
class AuthService {
    constructor() {
        this.tokens = new Map();
        this.defaultTTL = 24 * 60 * 60;
        this.accountsCache = null;
    }
    async getAccounts() {
        if (this.accountsCache)
            return this.accountsCache;
        const cfg = await this.loadConfig();
        const accounts = cfg.auth?.defaultAccounts || [
            { username: 'admin', password: 'admin123!', role: 'admin' },
        ];
        this.accountsCache = new Map(accounts.map((a) => [a.username, { ...a }]));
        return this.accountsCache;
    }
    async login(username, password) {
        const dbUser = await (0, db_1.withClient)(async (client) => {
            const { rows } = await client.query('SELECT id, username, password_plain, role, status FROM users WHERE username=$1 LIMIT 1', [username]);
            return rows[0];
        });
        if (!dbUser || (dbUser.status && dbUser.status !== 'active')) {
            throw new Error('INVALID_CREDENTIALS');
        }
        if (password !== (dbUser.password_plain || '')) {
            throw new Error('INVALID_CREDENTIALS');
        }
        const user = { id: String(dbUser.id), username: dbUser.username, role: dbUser.role || undefined };
        const cfg = await this.loadConfig();
        const ttl = cfg.auth?.tokenTTLSeconds ?? this.defaultTTL;
        const token = (0, helpers_1.generateId)();
        const exp = Date.now() + ttl * 1000;
        this.tokens.set(token, { user, exp });
        return { token, user, expiresIn: ttl };
    }
    async profile(token) {
        const record = this.tokens.get(token);
        if (!record)
            throw new Error('UNAUTHORIZED');
        if (Date.now() > record.exp) {
            this.tokens.delete(token);
            throw new Error('TOKEN_EXPIRED');
        }
        return record.user;
    }
    async logout(token) {
        this.tokens.delete(token);
    }
    async changePassword(token, oldPassword, newPassword) {
        const record = this.tokens.get(token);
        if (!record)
            throw new Error('UNAUTHORIZED');
        const username = record.user.username;
        const dbUser = await (0, db_1.withClient)(async (client) => {
            const { rows } = await client.query('SELECT id, username, password_plain FROM users WHERE username=$1 LIMIT 1', [username]);
            return rows[0];
        });
        if (!dbUser)
            throw new Error('UNAUTHORIZED');
        if ((dbUser.password_plain || '') !== oldPassword)
            throw new Error('INVALID_OLD_PASSWORD');
        await (0, db_1.withClient)(async (client) => {
            await client.query('UPDATE users SET password_plain=$1, updated_at=NOW() WHERE username=$2', [newPassword, username]);
        });
    }
    async loadConfig() {
        try {
            return await (0, config_1.readJsonc)('config/config.jsonc');
        }
        catch (e) {
            return {};
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map