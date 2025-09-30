import { Request, Response, NextFunction } from 'express';
export declare class ChatController {
    private agentService;
    private chatService;
    private initService;
    private fastgptSessionService;
    constructor();
    private chatInitSchema;
    private chatRequestSchema;
    private historyListSchema;
    private historyDetailSchema;
    private historyDeleteSchema;
    private historyRetrySchema;
    private feedbackSchema;
    chatCompletions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private handleNormalRequest;
    private handleStreamRequest;
    private sendSSEEvent;
    chatInit: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private handleInitNormalRequest;
    private handleInitStreamRequest;
    updateUserFeedback: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listChatHistories: (req: Request, res: Response) => Promise<void>;
    getChatHistory: (req: Request, res: Response) => Promise<void>;
    deleteChatHistory: (req: Request, res: Response) => Promise<void>;
    clearChatHistories: (req: Request, res: Response) => Promise<void>;
    retryChatMessage: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=ChatController.d.ts.map