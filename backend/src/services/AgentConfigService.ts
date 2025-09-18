import fs from 'fs/promises';
import path from 'path';
import { AgentConfig, Agent, AgentStatus, AgentHealthStatus } from '@/types';

/**
 * 智能体配置服务
 * 负责加载、管理和验证智能体配置
 */
export class AgentConfigService {
  private configPath: string;
  private agents: Map<string, AgentConfig> = new Map();
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  constructor(configPath?: string) {
    this.configPath = configPath || 
      process.env.AGENTS_CONFIG_PATH || 
      path.join(__dirname, '../../../config/agents.json');
  }

  /**
   * 加载智能体配置
   */
  async loadAgents(): Promise<AgentConfig[]> {
    try {
      // 检查缓存是否有效
      const now = Date.now();
      if (this.agents.size > 0 && now - this.lastLoadTime < this.CACHE_TTL) {
        return Array.from(this.agents.values());
      }

      // 读取配置文件
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);

      if (!config.agents || !Array.isArray(config.agents)) {
        throw new Error('配置文件格式错误：缺少agents数组');
      }

      // 清空现有缓存
      this.agents.clear();

      // 验证并加载每个智能体配置
      for (const agentConfig of config.agents) {
        if (this.validateAgentConfig(agentConfig)) {
          this.agents.set(agentConfig.id, agentConfig);
        } else {
          console.warn(`智能体配置验证失败: ${agentConfig.id || '未知ID'}`);
        }
      }

      this.lastLoadTime = now;
      console.log(`✅ 成功加载 ${this.agents.size} 个智能体配置`);
      
      return Array.from(this.agents.values());
    } catch (error) {
      console.error('加载智能体配置失败:', error);
      throw new Error(`无法加载智能体配置: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取特定智能体配置
   */
  async getAgent(id: string): Promise<AgentConfig | null> {
    // 确保配置已加载
    if (this.agents.size === 0) {
      await this.loadAgents();
    }

    return this.agents.get(id) || null;
  }

  /**
   * 获取可用的智能体列表（简化版本，用于前端显示）
   */
  async getAvailableAgents(): Promise<Agent[]> {
    const configs = await this.loadAgents();
    
    return configs
      .filter(config => config.isActive)
      .map(config => this.transformToAgent(config));
  }

  /**
   * 获取所有智能体（包括不可用的）
   */
  async getAllAgents(): Promise<Agent[]> {
    const configs = await this.loadAgents();
    
    return configs.map(config => this.transformToAgent(config));
  }

  /**
   * 检查智能体健康状态
   */
  async checkAgentHealth(id: string): Promise<AgentHealthStatus> {
    const config = await this.getAgent(id);
    if (!config) {
      return {
        agentId: id,
        status: 'error',
        lastChecked: new Date().toISOString(),
        error: '智能体不存在',
      };
    }

    const startTime = Date.now();
    let status: AgentStatus = 'inactive';
    let error: string | undefined;

    try {
      // 这里可以实现具体的健康检查逻辑
      // 例如发送一个简单的请求到智能体端点
      if (config.isActive) {
        status = 'active';
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : '健康检查失败';
    }

    return {
      agentId: id,
      status,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error,
    };
  }

  /**
   * 验证智能体配置
   */
  private validateAgentConfig(config: any): config is AgentConfig {
    const requiredFields = ['id', 'name', 'description', 'endpoint', 'apiKey', 'model', 'provider'];
    
    // 检查必需字段
    for (const field of requiredFields) {
      if (!config[field]) {
        console.error(`智能体配置缺少必需字段: ${field}`);
        return false;
      }
    }

    // 检查ID唯一性
    if (this.agents.has(config.id)) {
      console.error(`智能体ID重复: ${config.id}`);
      return false;
    }

    // 检查provider是否合法
    const validProviders = ['fastgpt', 'openai', 'anthropic', 'custom'];
    if (!validProviders.includes(config.provider)) {
      console.error(`不支持的provider: ${config.provider}`);
      return false;
    }

    // 检查endpoint格式
    try {
      new URL(config.endpoint);
    } catch {
      console.error(`无效的endpoint URL: ${config.endpoint}`);
      return false;
    }

    return true;
  }

  /**
   * 将AgentConfig转换为Agent（去除敏感信息）
   */
  private transformToAgent(config: AgentConfig): Agent {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      model: config.model,
      status: config.isActive ? 'active' : 'inactive',
      capabilities: config.capabilities,
      provider: config.provider,
    };
  }

  /**
   * 重新加载配置（强制刷新缓存）
   */
  async reloadAgents(): Promise<AgentConfig[]> {
    this.lastLoadTime = 0;
    this.agents.clear();
    return this.loadAgents();
  }

  /**
   * 更新智能体配置
   */
  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<void> {
    const config = await this.getAgent(id);
    if (!config) {
      throw new Error(`智能体不存在: ${id}`);
    }

    // 更新配置
    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // 验证更新后的配置
    if (!this.validateAgentConfig(updatedConfig)) {
      throw new Error('更新后的配置验证失败');
    }

    // 更新内存中的配置
    this.agents.set(id, updatedConfig);

    // 保存到文件
    await this.saveAgentsToFile();
  }

  /**
   * 保存配置到文件
   */
  private async saveAgentsToFile(): Promise<void> {
    try {
      const config = {
        agents: Array.from(this.agents.values()),
      };

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('✅ 智能体配置已保存');
    } catch (error) {
      console.error('保存智能体配置失败:', error);
      throw new Error('无法保存智能体配置');
    }
  }
}