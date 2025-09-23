import { Request, Response, NextFunction } from 'express';
export declare class ChatController {
    private agentService;
    private chatService;
    constructor();
    private chatRequestSchema;
    chatCompletions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private handleNormalRequest;
    private handleStreamRequest;
    private sendSSEEvent;
    getChatHistory: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=ChatController.d.ts.map