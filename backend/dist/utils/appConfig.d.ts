export interface LoggingExporterConfig {
    type: 'http' | 'elasticsearch' | 'clickhouse';
    enabled?: boolean;
    endpoint?: string;
    index?: string;
    table?: string;
    headers?: Record<string, string>;
    apiKey?: string;
    username?: string;
    password?: string;
    batchSize?: number;
    flushIntervalMs?: number;
}
export interface AppConfig {
    logging?: {
        enabled?: boolean;
        dir?: string;
        record?: {
            normal?: boolean;
            stream?: boolean;
        };
        include?: {
            raw?: boolean;
            normalized?: boolean;
        };
        exporters?: LoggingExporterConfig[];
    };
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
export declare function loadAppConfig(): AppConfig;
export declare function resolveLoggingExportersFromEnv(): LoggingExporterConfig[];
//# sourceMappingURL=appConfig.d.ts.map