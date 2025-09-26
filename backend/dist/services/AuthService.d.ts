export interface DefaultAccount {
    username: string;
    password: string;
    role?: string;
}
export interface AuthUser {
    id: string;
    username: string;
    role?: string;
}
export interface LoginResult {
    token: string;
    user: AuthUser;
    expiresIn: number;
}
export declare class AuthService {
    private tokens;
    private readonly defaultTTL;
    private accountsCache;
    private getAccounts;
    login(username: string, password: string): Promise<LoginResult>;
    profile(token: string): Promise<AuthUser>;
    logout(token: string): Promise<void>;
    changePassword(token: string, oldPassword: string, newPassword: string): Promise<void>;
    private loadConfig;
}
//# sourceMappingURL=AuthService.d.ts.map