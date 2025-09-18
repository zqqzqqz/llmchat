# FastGPT 对话接口 API 文档

## 概述

FastGPT OpenAPI 对话接口文档，该接口兼容 GPT 的标准接口格式，可以通过修改 BaseUrl 和 Authorization 来直接访问 FastGPT 应用。

## 获取 AppId

可在应用详情的路径里获取 AppId。

## 接口规则

- 该接口的 API Key 需使用应用特定的 key，否则会报错
- 有些包调用时，BaseUrl 需要添加 v1 路径，有些不需要，如果出现 404 情况，可补充 v1 重试
- 传入的 model、temperature 等参数字段均无效，这些字段由编排决定，不会根据 API 参数改变
- 不会返回实际消耗 Token 值，如果需要，可以设置 detail=true，并手动计算 responseData 里的 tokens 值

## 接口详情

### 请求 URL

```
POST http://localhost:3000/api/v1/chat/completions
```

### 请求头

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| Authorization | string | 是 | Bearer [apikey] |
| Content-Type | string | 是 | application/json |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| chatId | string | 否 | 对话 ID。为空时不使用 FastGPT 提供的上下文功能，完全通过传入的 messages 构建上下文；为非空字符串时，使用 chatId 进行对话，自动从 FastGPT 数据库取历史记录。长度小于 250 |
| stream | boolean | 否 | 是否流式输出 |
| detail | boolean | 否 | 是否返回中间值（模块状态，响应的完整结果等） |
| responseChatItemId | string | 否 | 响应消息的 ID，FastGPT 会自动将该 ID 存入数据库 |
| variables | object | 否 | 模块变量，会替换模块中输入框内容里的 [key] |
| messages | array | 是 | 消息数组，结构与 GPT 接口 chat 模式一致 |

#### messages 参数结构

##### 基础文本消息

```json
{
  "role": "user",
  "content": "导演是谁"
}
```

##### 多媒体消息（图片/文件）

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "导演是谁"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "图片链接"
      }
    },
    {
      "type": "file_url",
      "name": "文件名",
      "url": "文档链接，支持 txt md html word pdf ppt csv excel"
    }
  ]
}
```

## 请求示例

### 基础请求示例

```bash
curl --location --request POST 'http://localhost:3000/api/v1/chat/completions' \
--header 'Authorization: Bearer fastgpt-xxxxxx' \
--header 'Content-Type: application/json' \
--data-raw '{
  "chatId": "my_chatId",
  "stream": false,
  "detail": false,
  "responseChatItemId": "my_responseChatItemId",
  "variables": {
    "uid": "asdfadsfasfd2323",
    "name": "张三"
  },
  "messages": [
    {
      "role": "user",
      "content": "导演是谁"
    }
  ]
}'
```

### 图片/文件请求示例

```bash
curl --location --request POST 'http://localhost:3000/api/v1/chat/completions' \
--header 'Authorization: Bearer fastgpt-xxxxxx' \
--header 'Content-Type: application/json' \
--data-raw '{
  "chatId": "abcd",
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "导演是谁"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "图片链接"
          }
        },
        {
          "type": "file_url",
          "name": "文件名",
          "url": "文档链接，支持 txt md html word pdf ppt csv excel"
        }
      ]
    }
  ]
}'
```

## 响应格式

### 标准响应 (detail=false, stream=false)

```json
{
  "id": "adsfasf",
  "model": "",
  "usage": {
    "prompt_tokens": 1,
    "completion_tokens": 1,
    "total_tokens": 1
  },
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "电影《铃芽之旅》的导演是新海诚。"
      },
      "finish_reason": "stop",
      "index": 0
    }
  ]
}
```

### 流式响应 (detail=false, stream=true)

```
data: {"id":"","object":"","created":0,"choices":[{"delta":{"content":""},"index":0,"finish_reason":null}]}

data: {"id":"","object":"","created":0,"choices":[{"delta":{"content":"电"},"index":0,"finish_reason":null}]}

data: {"id":"","object":"","created":0,"choices":[{"delta":{"content":"影"},"index":0,"finish_reason":null}]}

data: {"id":"","object":"","created":0,"choices":[{"delta":{"content":"《"},"index":0,"finish_reason":null}]}
```

### 详细响应 (detail=true, stream=false)

```json
{
  "responseData": [
    {
      "moduleName": "Dataset Search",
      "price": 1.2000000000000002,
      "model": "Embedding-2",
      "tokens": 6,
      "similarity": 0.61,
      "limit": 3
    },
    {
      "moduleName": "AI Chat",
      "price": 454.5,
      "model": "FastAI-4k",
      "tokens": 303,
      "question": "导演是谁",
      "answer": "电影《铃芽之旅》的导演是新海诚。",
      "maxToken": 2050,
      "quoteList": [
        {
          "dataset_id": "646627f4f7b896cfd8910e38",
          "id": "8099",
          "q": "本作的主人公是谁？",
          "a": "本作的主人公是名叫铃芽的少女。",
          "source": "手动修改"
        }
      ],
      "completeMessages": [
        {
          "obj": "System",
          "value": "下面是知识库内容:\n1. [本作的主人公是谁？\n本作的主人公是名叫铃芽的少女。]"
        },
        {
          "obj": "Human",
          "value": "导演是谁"
        },
        {
          "obj": "AI",
          "value": "电影《铃芽之旅》的导演是新海诚。"
        }
      ]
    }
  ],
  "id": "",
  "model": "",
  "usage": {
    "prompt_tokens": 1,
    "completion_tokens": 1,
    "total_tokens": 1
  },
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "电影《铃芽之旅》的导演是新海诚。"
      },
      "finish_reason": "stop",
      "index": 0
    }
  ]
}
```

### 详细流式响应 (detail=true, stream=true)

#### Event 类型说明

| Event 类型 | 说明 |
|------------|------|
| flowNodeStatus | 模块状态，显示当前运行的模块名称和状态 |
| answer | 回答内容，包含增量的文本响应 |
| flowResponses | 流程响应，包含各模块的详细执行信息 |

#### 响应示例

```
event: flowNodeStatus
data: {"status":"running","name":"知识库搜索"}

event: flowNodeStatus
data: {"status":"running","name":"AI 对话"}

event: answer
data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"content":"电影"},"index":0,"finish_reason":null}]}

event: answer
data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"content":"《铃"},"index":0,"finish_reason":null}]}

event: answer
data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"content":"芽之旅》"},"index":0,"finish_reason":null}]}

event: answer
data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"content":"的导演是新"},"index":0,"finish_reason":null}]}

event: answer
data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"content":"海诚。"},"index":0,"finish_reason":null}]}

event: answer
data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}

event: answer
data: [DONE]

event: flowResponses
data: [详细的模块执行信息]
```

## 响应字段说明

### 标准字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 响应 ID |
| model | string | 模型名称 |
| usage | object | Token 使用情况 |
| choices | array | 选择结果数组 |

### usage 字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| prompt_tokens | number | 输入 token 数量 |
| completion_tokens | number | 输出 token 数量 |
| total_tokens | number | 总 token 数量 |

### choices 字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| message | object | 消息内容 |
| finish_reason | string | 结束原因，通常为 "stop" |
| index | number | 选择索引 |

### responseData 字段（detail=true 时）

包含各个模块的详细执行信息，如知识库搜索结果、AI 对话过程等。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| moduleName | string | 模块名称 |
| price | number | 消耗费用 |
| model | string | 使用的模型 |
| tokens | number | 消耗的 token 数量 |
| question | string | 问题内容 |
| answer | string | 回答内容 |
| quoteList | array | 引用的知识库内容 |
| completeMessages | array | 完整的对话消息链 |

## 注意事项

1. **API Key 管理**：请妥善保管您的 API Key，避免泄露
2. **文件上传**：目前不支持直接上传文件，需要先上传到对象存储获取链接
3. **chatId 唯一性**：请确保在您的系统中 chatId 是唯一的
4. **Token 计算**：如需准确的 Token 消耗统计，请设置 detail=true 并计算 responseData 中的值
5. **兼容性**：接口兼容 GPT 标准格式，便于从现有 GPT 应用迁移

## 错误处理

请注意处理以下常见错误：

- **404 错误**：尝试在 BaseUrl 后添加 `/v1` 路径
- **认证失败**：检查 API Key 是否正确，确保使用应用特定的 key
- **参数错误**：检查必填参数是否完整，参数格式是否正确

---

**文档来源**：[FastGPT 官方文档](https://doc.fastgpt.cn/docs/introduction/development/openapi/chat)

**最后更新**：2025-09-18