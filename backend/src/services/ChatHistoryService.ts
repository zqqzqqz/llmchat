import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';

export interface ChatHistoryQueryOptions {
  limit?: number;
  offset?: number;
  roles?: Array<'user' | 'assistant' | 'system'>;
}

export interface StoredChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface StoredChatSession {
  id: string;
  agentId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ChatHistoryService {
  async ensureSession(sessionId: string, agentId: string, title?: string | null): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO chat_sessions (id, agent_id, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           agent_id = EXCLUDED.agent_id,
           title = COALESCE(EXCLUDED.title, chat_sessions.title),
           updated_at = NOW()`,
        [sessionId, agentId, title || null]
      );
    });
  }

  async appendMessage(params: {
    sessionId: string;
    agentId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, any> | null;
    messageId?: string;
    titleHint?: string;
  }): Promise<string> {
    const messageId = params.messageId || generateId();
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO chat_sessions (id, agent_id, title)
           VALUES ($1,$2,$3)
           ON CONFLICT (id) DO UPDATE SET
             agent_id = EXCLUDED.agent_id,
             title = COALESCE(EXCLUDED.title, chat_sessions.title),
             updated_at = NOW()`
          , [params.sessionId, params.agentId, params.titleHint || null]
        );

        await client.query(
          `INSERT INTO chat_messages (id, session_id, role, content, metadata)
           VALUES ($1,$2,$3,$4,$5::jsonb)`
          , [
            messageId,
            params.sessionId,
            params.role,
            params.content,
            JSON.stringify(params.metadata ?? null),
          ]
        );

        await client.query(
          `UPDATE chat_sessions
             SET updated_at = NOW(),
                 title = COALESCE($2, title)
           WHERE id = $1`,
          [params.sessionId, params.titleHint || null]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    return messageId;
  }

  async getHistory(sessionId: string, options?: ChatHistoryQueryOptions): Promise<{
    session: StoredChatSession | null;
    messages: StoredChatMessage[];
  }> {
    const rolesFilter = options?.roles;
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
    const offset = Math.max(options?.offset ?? 0, 0);

    const { session, messages } = await withClient(async (client) => {
      const sessionResult = await client.query<{
        id: string;
        agent_id: string;
        title: string | null;
        created_at: Date;
        updated_at: Date;
      }>('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);

      const messageQueryParts: string[] = [
        'SELECT * FROM chat_messages WHERE session_id = $1'
      ];
      const params: any[] = [sessionId];

      if (rolesFilter && rolesFilter.length > 0) {
        messageQueryParts.push(`AND role = ANY($${params.length + 1})`);
        params.push(rolesFilter);
      }

      messageQueryParts.push('ORDER BY created_at ASC');
      messageQueryParts.push(`LIMIT $${params.length + 1}`);
      params.push(limit);
      messageQueryParts.push(`OFFSET $${params.length + 1}`);
      params.push(offset);

      const messagesResult = await client.query<{
        id: string;
        session_id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        metadata: any;
        created_at: Date;
      }>(messageQueryParts.join(' '), params);

      return {
        session: sessionResult.rows[0] || null,
        messages: messagesResult.rows,
      };
    });

    return {
      session: session
        ? {
            id: session.id,
            agentId: session.agent_id,
            title: session.title,
            createdAt: new Date(session.created_at).toISOString(),
            updatedAt: new Date(session.updated_at).toISOString(),
          }
        : null,
      messages: messages.map((msg) => ({
        id: msg.id,
        sessionId: msg.session_id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata ?? null,
        createdAt: new Date(msg.created_at).toISOString(),
      })),
    };
  }
}
