import { Pool } from 'pg';
export interface PgConfig {
    database?: {
        postgres?: {
            host: string;
            port?: number;
            user: string;
            password: string;
            database: string;
            ssl?: boolean;
        };
    };
    auth?: {
        tokenTTLSeconds?: number;
    };
}
export declare function getPool(): Pool;
export declare function initDB(): Promise<void>;
export declare function withClient<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T>;
export declare function hashPassword(password: string, salt?: string): {
    salt: string;
    hash: string;
};
export declare function closeDB(): Promise<void>;
//# sourceMappingURL=db.d.ts.map