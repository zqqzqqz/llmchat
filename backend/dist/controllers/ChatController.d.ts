import { Request, Response, NextFunction } from 'express';
export declare class ChatController {
    private agentService;
    private chatService;
    private initService;
    constructor();
    private chatInitSchema;
    private chatRequestSchema;
    private feedbackSchema;
    chatCompletions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private handleNormalRequest;
    private handleStreamRequest;
    private sendSSEEvent;
    chatInit: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private handleInitNormalRequest;
    private handleInitStreamRequest;
    updateUserFeedback: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getChatHistory: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=ChatController.d.ts.map