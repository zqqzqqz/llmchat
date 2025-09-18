import axios from 'axios';
import { Agent, ChatMessage, ChatOptions, ChatResponse } from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const agentService = {
  async getAgents(): Promise<Agent[]> {
    const response = await api.get('/agents');
    return response.data.data;
  },

  async getAgent(id: string): Promise<Agent> {
    const response = await api.get(`/agents/${id}`);
    return response.data.data;
  },

  async checkAgentStatus(id: string) {
    const response = await api.get(`/agents/${id}/status`);
    return response.data.data;
  },
};

export const chatService = {
  async sendMessage(
    agentId: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const response = await api.post('/chat/completions', {
      agentId,
      messages,
      stream: false,
      options,
    });
    return response.data.data;
  },

  async sendStreamMessage(
    agentId: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onStatus?: (status: any) => void,
    options?: ChatOptions
  ): Promise<void> {
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId,
        messages,
        stream: true,
        options,
      }),
    });

    if (!response.ok) {
      throw new Error('Stream request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: chunk')) {
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine?.startsWith('data: ')) {
              const data = JSON.parse(nextLine.slice(6));
              onChunk(data.content);
            }
          } else if (line.startsWith('event: status')) {
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine?.startsWith('data: ')) {
              const data = JSON.parse(nextLine.slice(6));
              onStatus?.(data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};