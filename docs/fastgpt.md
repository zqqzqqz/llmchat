# FastGPT 完整 API 文档

本文件汇总 FastGPT 对话与历史接口的完整规范、事件模型、回退策略与错误语义映射，确保系统在生产环境中稳定、精准地解析与渲染。

## 1. 对话接口（兼容 OpenAI Chat API）
- 基础端点：`POST {BASE_URL}/api/v1/chat/completions`
- 认证方式：`Authorization: Bearer fastgpt-xxxxxx`
- 关键参数：
  - `chatId`（可选）：会话ID（用于上下文与交互节点继续运行）
  - `stream`（可选）：是否启用流式
  - `detail`（可选）：是否返回模块执行等详细信息
  - `variables`（可选）：工作流变量
  - `responseChatItemId`（可选）：用于“重新生成”绑定目标消息ID
- 事件模型（SSE）：
  - `flowNodeStatus`：工作流模块状态
  - `answer`：增量文本（正文仅追加此事件中的 `choices[0].delta.content`）
  - `flowResponses`：详细执行信息（detail=true）
  - `interactive`：交互节点信息（detail=true）
  - `usage`：令牌用量统计
  - `end` / `[DONE]`：结束标记
- 解析准则：仅将 `answer` 的增量文本追加到消息正文；其他所有事件进入状态与事件流，不进入正文。

## 2. 历史接口（应用会话列表/详情/删除/清空）
- 基础端点：以 `BASE_URL` 为对话端点去除 `/api/v1/chat/completions` 后得到。
- 历史接口可能存在不同路径：
  - 列表（尝试序列）：
    - `/api/core/chat/history/list`
    - `/api/core/chat/history/getHistoryList`
    - `/api/core/chat/history/getHistories`
  - 详情（尝试序列）：
    - `/api/core/chat/history/detail`
    - `/api/core/chat/history/getHistory`
    - `/api/core/chat/history/messages`
  - 删除：
    - `/api/core/chat/history/delete`
    - `/api/core/chat/history/removeHistory`
    - `/api/core/chat/history/delHistory`
  - 清空：
    - `/api/core/chat/history/clear`
    - `/api/core/chat/history/clearHistories`
    - （部分环境支持 DELETE `/api/core/chat/history/clear`）

### 2.1 /v1 回退策略
- 部分环境或 SDK 需要在核心接口前添加 `/v1` 前缀；如果访问上述路径返回 404，则自动回退尝试：`{BASE_URL}/v1{PATH}`。
- 示例：
  - 初次请求：`{BASE_URL}/api/core/chat/history/getHistories`
  - 若返回 404，则回退：`{BASE_URL}/v1/api/core/chat/history/getHistories`

### 2.2 URL 构造与净化
- 移除路径中的反引号与空白字符，避免请求格式污染：
  - `cleanPath = path.replace(/[\`\s]+/g, '')`
  - `cleanBase = endpoint.replace(/[\`\s]+/g, '').replace(/\/$/, '')`
- `BASE_URL` 计算：若 endpoint 以 `/api/v1/chat/completions` 结尾，则去除该后缀；否则去除末尾斜杠。

### 2.3 参数与响应规范
- 所有历史接口均需携带 `appId` 参数（24位HEX），必要时携带 `chatId`。
- 响应 `code` 不为 200 视为业务错误。
- 列表响应可能在 `data.list`、`data`、`historyList`、`list` 等位置；需做规范化处理。
- 详情响应可能在 `data.list`、`messages`、`history`、`chatHistoryList` 等位置；需做规范化处理。

### 2.4 错误语义与状态码映射
- 本地校验错误：
  - `NOT_FOUND`（agentId不存在）→ 404
  - `INVALID_PROVIDER`（非fastgpt智能体）→ 400
  - `INVALID_APP_ID`（appId缺失或无效）→ 400
- 上游错误（AxiosError.response.status）：
  - 404 → 502（上游接口不可用；已自动尝试 /v1 回退）
  - 401 → 401（鉴权失败）
  - 408/超时 → 504（网关超时）
- 其他未分类错误 → 500

## 3. 交互节点继续运行（detail=true）
- 当事件 `interactive` 返回用户选择或表单配置后，需要保持 `chatId` 一致并重新调用对话接口：
  - 用户选择：将选项文本作为 `messages[0].content`
  - 表单输入：将表单对象序列化为字符串传入 `messages[0].content`

## 4. 解析与渲染的生产准则
- 仅将 `answer` 的 `choices[0].delta.content` 追加到消息正文；
- 对于字符串兜底（payload 是字符串）若以 `{` 或 `[` 开头，视为结构化数据，不进入正文；
- 所有非 `answer` 事件，进入状态/事件流并驱动 UI（例如模块状态、交互弹窗、详细执行信息）。

## 5. 验证与测试建议（Windows 环境）
- 单元测试：历史列表/详情接口的 URL 净化与 /v1 回退；错误代码映射。
- 集成测试：真实 FastGPT 环境返回 404 时自动回退，最终状态码与文案正确。
- 端到端测试（Playwright）：历史列表加载、交互节点继续运行、流式回答无重复与碎片化。
- 注意 PowerShell 指令分隔使用 `;`（避免 `&&` 解析错误）。

## 6. 参考
- 官方对话接口文档与事件示例（需关注 `/v1` 前缀差异与事件模型）：
- 对话事件示例（answer/flowNodeStatus/flowResponses 等）可用于端到端校验。