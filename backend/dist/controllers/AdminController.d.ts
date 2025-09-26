import { Request, Response } from 'express';
export declare class AdminController {
    static systemInfo(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static users(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static logs(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    static logsExport(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=AdminController.d.ts.map