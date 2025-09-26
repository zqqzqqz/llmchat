import { Request, Response, NextFunction } from 'express';
export declare class AgentController {
    private agentService;
    private chatService;
    constructor();
    getAgents: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getAgent: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getAgentStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    reloadAgents: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    validateAgent: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateAgent: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=AgentController.d.ts.map