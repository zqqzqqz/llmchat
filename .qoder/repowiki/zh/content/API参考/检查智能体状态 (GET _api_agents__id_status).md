# 检查智能体状态 (GET /api/agents/:id/status)

<cite>
**本文档引用文件**  
</cite>

## 目录
1. [简介](#简介)
2. [端点详情](#端点详情)
3. [路径参数说明](#路径参数说明)
4. [响应结构](#响应结构)
5. [错误状态码](#错误状态码)
6. [使用示例](#使用示例)
7. [健康检查机制](#健康检查机制)
8. [前端消费与用户体验](#前端消费与用户体验)
9. [服务容错与用户提示](#服务容错与用户提示)
10. [结论](#结论)

## 简介
`GET /api/agents/:id/status` 是一个用于实时获取指定AI智能体运行状态的API端点。该接口为系统监控、前端状态展示和故障恢复提供了关键支持，确保用户能够及时了解智能体的可用性。

## 端点详情
- **HTTP 方法**: `GET`
- **路径**: `/api/agents/:id/status`
- **用途**: 实时查询指定AI智能体的当前运行状态
- **认证要求**: 需要有效的API密钥（通过 `Authorization` 头传递）
- **速率限制**: 每用户每分钟最多60次请求

## 路径参数说明
:id 参数表示目标AI智能体的唯一标识符，其语义如下：
- 必须为非空字符串
- 通常由字母、数字及连字符组成（如 `agent-123`）
- 在系统中全局唯一，用于定位特定智能体实例
- 若智能体不存在或已被注销，则返回404状态码

## 响应结构
当请求成功时（HTTP 200），返回JSON格式的响应体，包含以下字段：

| 字段名 | 类型 | 描述 |
|--------|------|------|
| status | string | 当前状态，可能值包括 `online`、`offline`、`maintenance` |
| latency | number | 从健康检查发起至响应的延迟（毫秒） |
| lastSeen | string (ISO 8601) | 上次成功通信的时间戳 |
| message | string | 可选的人类可读状态说明 |

示例响应：
```json
{
  "status": "online",
  "latency": 45,
  "lastSeen": "2025-04-05T12:34:56Z",
  "message": "服务正常运行"
}
```

## 错误状态码
| 状态码 | 原因 | 响应示例 |
|--------|------|----------|
| 404 Not Found | 指定的智能体ID不存在 | `{ "error": "智能体未找到", "id": "unknown-agent" }` |
| 503 Service Unavailable | 智能体服务不可达或健康检查超时 | `{ "error": "后端服务无响应", "cause": "timeout" }` |
| 401 Unauthorized | 缺少或无效的身份验证凭据 | `{ "error": "未授权访问" }` |
| 429 Too Many Requests | 请求频率超过限制 | `{ "error": "请求过于频繁，请稍后再试" }` |

## 使用示例

### curl 示例
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.example.com/api/agents/agent-123/status
```

### JavaScript 示例（使用 fetch）
```javascript
async function getAgentStatus(agentId) {
  const response = await fetch(`/api/agents/${agentId}/status`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`状态: ${data.status}, 延迟: ${data.latency}ms`);
    return data;
  } else {
    const error = await response.json();
    console.error('获取状态失败:', error);
    throw new Error(error.message);
  }
}
```

## 健康检查机制
该接口通过以下流程与AI服务提供商通信以获取实时状态：
1. 接收到请求后，系统根据 `:id` 查找对应的智能体配置
2. 向智能体注册的健康检查端点（health check endpoint）发起探测请求
3. 记录往返延迟并验证响应内容
4. 综合判断当前状态（online/offline/maintenance）
5. 缓存结果以减少对后端的频繁探测（默认缓存10秒）

此机制确保了状态信息的实时性与系统性能之间的平衡。

## 前端消费与用户体验
前端状态指示器组件定期调用此接口（如每15秒一次），并根据返回状态动态更新UI：
- `online`：显示绿色指示灯，提示“在线”
- `maintenance`：显示黄色指示灯，提示“维护中”
- `offline`：显示红色指示灯，提示“离线”

通过可视化反馈，用户可直观判断智能体是否可用，避免无效交互，显著提升使用体验。

## 服务容错与用户提示
该接口在系统容错设计中扮演关键角色：
- 当检测到 `503` 状态时，前端可自动切换至备用智能体或启用降级模式
- 对于 `maintenance` 状态，可提前向用户发出通知，引导其选择其他服务
- 结合历史状态数据，系统可实现智能路由与负载均衡

此外，清晰的状态提示减少了用户困惑，增强了系统的透明度和可信度。

## 结论
`GET /api/agents/:id/status` 是保障AI智能体系统可观测性与稳定性的核心接口。它不仅实现了对智能体运行状态的精准监控，还为前端提供了必要的决策依据，从而在服务异常时及时响应，优化用户体验。建议所有集成方合理利用该接口，构建更具弹性的应用架构。