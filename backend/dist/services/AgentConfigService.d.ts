import { AgentConfig, Agent, AgentHealthStatus } from '@/types';
export declare class AgentConfigService {
    private configPath;
    private agents;
    private lastLoadTime;
    private readonly CACHE_TTL;
    constructor(configPath?: string);
    loadAgents(): Promise<AgentConfig[]>;
    getAgent(id: string): Promise<AgentConfig | null>;
    getAvailableAgents(): Promise<Agent[]>;
    getAllAgents(): Promise<Agent[]>;
    checkAgentHealth(id: string): Promise<AgentHealthStatus>;
    private validateAgentConfig;
    private transformToAgent;
    reloadAgents(): Promise<AgentConfig[]>;
    updateAgent(id: string, updates: Partial<AgentConfig>): Promise<void>;
    private saveAgentsToFile;
}
//# sourceMappingURL=AgentConfigService.d.ts.map