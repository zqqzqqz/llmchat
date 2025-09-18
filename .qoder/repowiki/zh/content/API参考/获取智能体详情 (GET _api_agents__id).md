# 获取智能体详情 (GET /api/agents/:id)

<cite>
**本文档引用文件**  
</cite>

## 目录
1. [介绍](#介绍)
2. [端点详情](#端点详情)
3. [路径参数](#路径参数)
4. [成功响应](#成功响应)
5. [错误响应](#错误响应)
6. [调用示例](#调用示例)
7. [后端服务交互](#后端服务交互)
8. [前端集成场景](#前端集成场景)
9. [结论](#结论)

## 介绍
本接口用于根据智能体唯一标识符获取特定AI智能体的详细配置信息。该端点为前端动态加载智能体上下文提供支持，确保与代理服务的配置一致性。

## 端点详情
- **方法**: GET  
- **路径**: `/api/agents/:id`  
- **用途**: 获取指定ID的AI智能体配置  
- **返回**: `AgentConfig` 对象或错误状态码  

## 路径参数
:id 路径参数表示智能体的唯一标识符，需满足以下约束：
- 必须为非空字符串
- 长度应在1到64字符之间
- 仅允许字母、数字、连字符（-）和下划线（_）
- 不区分大小写，但建议使用小写格式以保持一致性

若参数不符合上述格式，将返回400错误。

## 成功响应
- **状态码**: `200 OK`  
- **响应体**: 包含 `AgentConfig` 结构，字段如下：
  - `endpoint`: 智能体服务的API端点URL
  - `provider`: 服务提供商名称（如 "openai", "anthropic"）
  - `apiKey`: 用于认证的密钥（前端应避免直接暴露）
  - `model`: 使用的模型名称
  - `temperature`: 生成温度参数
  - `maxTokens`: 最大生成令牌数
  - `enabled`: 是否启用该智能体

此配置由后端服务从持久化存储中加载，确保与系统当前状态一致。

## 错误响应
### 400 错误请求
- **状态码**: `400 Bad Request`  
- **触发条件**: :id 参数格式无效  
- **响应示例**:
```json
{
  "error": "Invalid agent ID format",
  "details": "Agent ID must be a non-empty string with valid characters"
}
```

### 404 智能体未找到
- **状态码**: `404 Not Found`  
- **触发条件**: 指定ID的智能体不存在  
- **响应示例**:
```json
{
  "error": "Agent not found",
  "details": "No agent exists with the specified ID"
}
```

## 调用示例
### 使用 curl
```bash
curl -X GET "http://localhost:3000/api/agents/openai-gpt4"
```

### 使用 Fetch API
```javascript
fetch('/api/agents/openai-gpt4')
  .then(response => {
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    return response.json();
  })
  .then(config => console.log('Agent Config:', config))
  .catch(err => console.error('Failed to load agent:', err));
```

## 后端服务交互
该接口通过调用 `AgentConfigService` 加载配置数据。服务层负责：
- 验证智能体ID格式
- 从配置存储（如数据库或文件系统）中检索 `AgentConfig`
- 返回标准化的配置对象
- 记录访问日志用于审计和监控

此设计实现了配置管理的集中化，便于维护和更新。

## 前端集成场景
前端可利用此接口实现以下功能：
- 动态加载智能体上下文以初始化聊天界面
- 在模型切换面板中显示当前配置
- 验证智能体可用性后启用相关操作按钮
- 与 `ChatProxyService` 同步配置，确保请求转发的一致性

通过异步加载机制，提升用户体验并减少初始加载时间。

## 结论
GET /api/agents/:id 是一个关键的配置查询接口，支持系统的灵活性和可扩展性。其清晰的错误处理和标准化响应结构有助于前后端高效协作。