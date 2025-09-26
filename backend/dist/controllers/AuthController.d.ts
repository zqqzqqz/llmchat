import { Request, Response } from 'express';
export declare class AuthController {
    static login(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static profile(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static logout(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static changePassword(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=AuthController.d.ts.map