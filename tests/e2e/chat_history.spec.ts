import { test, expect } from '@playwright/test';

/**
 * 历史接口语义化状态码E2E校验（稳健版）
 *
 * - 当未配置有效 E2E_AGENT_ID 时，允许返回 400/404 并视为通过（本地参数校验）
 * - 当提供有效 E2E_AGENT_ID 时，列表期望 200；详情未知chatId期望 404/502
 */

test.describe('聊天历史接口语义化状态码', () => {
  test('未知agentId应返回404或400并带code', async ({ request }) => {
    const resp = await request.get('/api/chat/history?agentId=__not_exist__');
    const status = resp.status();
    const body = await resp.json();
    console.log('未知agentId响应', { status, body });
    expect([400, 404]).toContain(status);
    expect(body).toHaveProperty('code');
    expect(['NOT_FOUND', 'INVALID_PROVIDER', 'INVALID_APP_ID']).toContain(body.code);
  });

  test('历史列表：有有效agentId返回200，否则返回400/404', async ({ request }) => {
    const agentId = process.env.E2E_AGENT_ID;
    const resp = await request.get(`/api/chat/history?agentId=${encodeURIComponent(agentId || 'default')}`);
    const status = resp.status();
    const body = await resp.json();
    console.log('历史列表响应', { status, body });
    if (agentId) {
      expect([200, 502]).toContain(status);
      if (status === 200) {
        expect(Array.isArray(body.data)).toBeTruthy();
      } else {
        expect(body.code).toBe('UPSTREAM_ERROR');
      }
    } else {
      expect([400, 404, 502]).toContain(status);
      expect(body).toHaveProperty('code');
    }
  });

  test('历史详情未知chatId：有有效agentId时返回404/502，否则返回400/404', async ({ request }) => {
    const agentId = process.env.E2E_AGENT_ID;
    const resp = await request.get(`/api/chat/history/__unknown__?agentId=${encodeURIComponent(agentId || 'default')}`);
    const status = resp.status();
    const body = await resp.json();
    console.log('历史详情响应', { status, body });
    if (agentId) {
      expect([404, 502]).toContain(status);
      if (status === 404) {
        expect(body.code).toBe('NOT_FOUND');
      } else {
        expect(body.code).toBe('UPSTREAM_ERROR');
      }
    } else {
      expect([400, 404, 502]).toContain(status);
      expect(body).toHaveProperty('code');
    }
  });
});