# 企业级 FASTGPT 智能体与聊天体验一体化交付计划

## 背景与总体目标
- ✅ `AgentConfigService` 已改造为以 PostgreSQL 为首要数据源，自动回填空库并与本地 JSON 快照互通，确保管理员在后台维护的配置即刻同步到缓存与用户端。 【F:backend/src/services/AgentConfigService.ts†L165-L220】【F:backend/src/services/AgentConfigService.ts†L253-L305】
- ✅ 数据库启动流程会建表并在首次运行时从 `config/agents.json` 迁移内置 FASTGPT 智能体，保证后台 CRUD、缓存和初始化接口以统一数据源驱动。 【F:backend/src/utils/db.ts†L32-L174】【F:backend/src/utils/db.ts†L200-L297】
- ✅ 管理端 `AgentsPanel` 已具备搜索、创建、编辑、删除、批量导入、状态切换与验证功能，并针对移动端提供抽屉式布局，所有操作都会刷新列表与缓存。 【F:frontend/src/components/admin/AdminHome.tsx†L1612-L1906】【F:frontend/src/services/agentsApi.ts†L1-L86】
- ✅ 聊天输入支持文件上传与语音录制，流式会话通过 `AbortController` 支持随时中断并与 Zustand store 同步状态，移动端交互已优化。 【F:frontend/src/components/chat/MessageInput.tsx†L1-L208】【F:frontend/src/services/api.ts†L93-L206】【F:frontend/src/store/chatStore.ts†L6-L250】
- ✅ 后端会话写入链路在 `ChatController` 内统一校验智能体状态、记录地域信息并落库消息，历史查询由 `ChatHistoryService` 提供分页能力；前端本地存储改为时间戳，确保跨时区可靠。 【F:backend/src/controllers/ChatController.ts†L281-L419】【F:backend/src/services/ChatHistoryService.ts†L17-L118】【F:frontend/src/store/chatStore.ts†L6-L360】

在上述核心能力落地后，下一阶段目标转向“持续稳健化”：巩固缓存一致性、补齐审计与观测能力、完善历史/回放体验，并围绕移动端保持轻量与高可用。

## 执行节奏总览
| 阶段 | 状态 | 目标 | 关键成果 |
| --- | --- | --- | --- |
| **P0 智能体治理启动** | ✅ 已完成 | 建立以数据库为中心的 FASTGPT 智能体配置体系，完成 JSON → 数据库的初始化与增删改闭环。 | 数据库建模、后端存储层、管理端 CRUD、缓存一致性策略。 |
| **P1 数据一致性与历史补齐** | 🔄 进行中 | 构建聊天历史存储/查询链路，修复前端持久化与时序问题。 | 会话表/消息表、历史 API、前端时间戳迁移、日志治理。 |
| **P2 体验底座强化** | 🔄 进行中 | 打磨智能体选择、初始化体验和错误兜底。 | Agent Selector 搜索/分组、加载/错误反馈、初始化 Skeleton & Toast。 |
| **P3 多模态与流控能力** | 🔄 进行中 | 实现附件/语音发送，提供中断/重试控制。 | 文件上传链路、语音录制 UI、AbortController 流控、系统消息提示。 |
| **P4 稳定性与发布** | ⏳ 待启动 | 压测、观测、回归测试与上线 SOP。 | 自动化测试、性能评估、灰度方案、文档与培训。 |

## P0：智能体数据治理与管理员功能（已完成）
- **数据库结构与初始化**：`initDB` 自动建表、创建索引并同步首个管理员账号，随后在空库场景下将 `agents.json` 导入数据库，形成统一数据源。 【F:backend/src/utils/db.ts†L32-L174】【F:backend/src/utils/db.ts†L200-L297】
- **服务层改造**：`AgentConfigService` 统一走数据库 + 内存缓存流程，在无数据时回填 JSON，并在增删改后写回快照，保持管理端、缓存与前端一致。 【F:backend/src/services/AgentConfigService.ts†L165-L220】【F:backend/src/services/AgentConfigService.ts†L324-L419】
- **后台接口与权限**：`AgentController` 对创建、更新、删除、导入、校验、重载等接口进行 Joi 校验并复用管理员鉴权，所有错误都以结构化响应返回。 【F:backend/src/controllers/AgentController.ts†L19-L452】
- **管理端界面**：`AgentsPanel` 提供搜索筛选、分页表格、移动端卡片、批量导入、状态切换与校验等能力，成功/失败均通过 toast 告知，并在操作后刷新列表。 【F:frontend/src/components/admin/AdminHome.tsx†L1612-L1906】
- **初始化链路**：聊天入口在请求前调用 `ChatHistoryService` 和地域统计，保证新会话落库、缓存更新及看板热点图同步。 【F:backend/src/controllers/ChatController.ts†L281-L419】

### 后续稳健化动作
1. 引入操作审计表或事件流，记录管理员 CRUD diff，便于追溯与回滚。
2. 将 `AgentConfigService` 快照写入失败时的告警/重试策略落地，防止多节点间配置漂移。 【F:backend/src/services/AgentConfigService.ts†L400-L419】
3. 补充导入/导出、状态切换的集成测试，防止后续需求引入回归。 【F:backend/src/services/AgentConfigService.ts†L165-L220】【F:frontend/src/components/admin/AdminHome.tsx†L1612-L1906】

## P1：聊天历史与数据一致性
| 事项 | 关键动作 | 输出 | 注意事项 |
| --- | --- | --- | --- |
| 会话/消息建模 | 新建 `chat_sessions`（会话元数据）与 `chat_messages`（消息体），字段包含 `agent_id`、`user_id`、`payload`、`role`、`created_at`。 | SQL 迁移脚本、Repository。 | 大字段拆分 JSONB，必要时压缩，建立 `(session_id, created_at)` 复合索引。 |
| 写入链路 | 在 `ChatProxyService.sendMessage`/`sendStreamMessage` 与反馈接口中写入消息、事件。 | 封装 `ChatLogService`，支持事务与失败降级。 | 避免阻塞主流程，失败时写队列或降级日志。 【F:backend/src/services/ChatProxyService.ts†L236-L592】【F:backend/src/services/ChatLogService.ts†L9-L170】 |
| 历史查询 | 实现 `ChatController.getChatHistory`，支持分页、按角色过滤与字段脱敏。 | 完整 API 响应、Swagger 文档。 | 404、空会话、权限校验；返回时注入 `agentId` 与 metadata。 【F:backend/src/controllers/ChatController.ts†L633-L661】 |
| 前端持久化迁移 | 将 `ChatSession.createdAt/updatedAt` 改为时间戳，升级 Zustand `persist` 并提供迁移函数；会话列表按“今天/昨天/更早”重新计算。 | Store/类型更新、迁移脚本。 | 兼容旧数据：检测 `Date` 字符串并转换；迁移失败时回退本地缓存。 【F:frontend/src/store/chatStore.ts†L200-L360】 |
| 缓存与回收 | 设计会话本地缓存上限，超限时触发 LRU；跨端登录时拉取最新会话列表。 | 缓存策略文档、配置项。 | 注意移动端存储容量，提供手动清理入口。 |

## P2：智能体选择与初始化体验
| 事项 | 关键动作 | 移动端/UX 要求 | 注意事项 |
| --- | --- | --- | --- |
| 智能体检索与分组 | 在 `AgentSelector` 加入搜索、状态过滤、最近使用分区；记忆滚动位置与键盘导航。 | 大屏悬浮面板 + 小屏全屏抽屉。 | 列表 >100 项时需节流或虚拟滚动，避免卡顿。 【F:frontend/src/components/agents/AgentSelector.tsx†L68-L178】 |
| 加载/错误提示 | 使用 `useAgents` 的 `error` 与 `AbortController`，展示 Skeleton + Toast + 重试按钮。 | 错误条在移动端占满宽度，支持点击关闭。 | 组件卸载时取消请求，避免状态更新警告。 【F:frontend/src/hooks/useAgents.ts†L1-L68】 |
| 初始化 Skeleton | 在 `ChatContainer` 触发开场白前渲染骨架；`chatService.initStream` 失败时给出重试 CTA 并记录埋点。 | Skeleton 适配暗色主题与触摸滚动。 | 重复进入同一会话不重复展示 skeleton；清除 `welcomeTriggeredKeyRef`。 【F:frontend/src/components/chat/ChatContainer.tsx†L141-L181】 |
| 初始化参数透传 | 初始化时自动附带管理员配置的参数（temperature、系统提示等），并与 FastGPT 初始化返回的数据对齐。 | 参数映射表。 | 新增字段需在后端校验，避免错误参数影响会话。 【F:backend/src/services/ChatInitService.ts†L37-L134】 |

## P3：多模态输入与流控能力
| 事项 | 关键动作 | 输出 | 注意事项 |
| --- | --- | --- | --- |
| 文件上传 | 在 `MessageInput` 引入隐藏 `<input type="file">`，支持拖拽、拍照；上传后通过新建 `POST /chat/attachments` 接口换取临时 URL，再随消息发送。 | 上传组件、进度条、失败重试。 | 限制类型/大小，结合后端病毒扫描占位接口。 【F:frontend/src/components/chat/MessageInput.tsx†L1-L118】 |
| 语音录制 | 使用 `MediaRecorder` 创建录音状态机，提供波形/计时 UI、滑动取消；发送前转码并压缩。 | 录音 Hook、移动端友好提示。 | Safari 兼容、权限失败处理、自动释放资源。 |
| 流式控制 | `chatService.sendStreamMessage`/`initStream` 接入 `AbortController`，`useChatStore` 存储请求句柄；UI 提供“停止生成”“重新生成”。 | 控制按钮、系统提示消息。 | 取消后要更新状态，避免残留加载；重试复用最后消息。 【F:frontend/src/services/api.ts†L1-L206】 |
| 错误回退 | 统一 Toast + 系统消息提示，并在移动端显示轻量 Banner；失败后保持输入框内容不丢失。 | 错误处理模块。 | 区分网络/权限类错误，给出对应解决建议。 |

## P4：测试、性能与发布
- **单元测试**：
  - 后端覆盖智能体 CRUD、初始化缓存、聊天历史、附件上传、FastGPT 调用失败等分支。
  - 前端为 Agent Selector、Admin CRUD 表单、流控、录音状态编写单元/组件测试。
- **集成测试**：
  - 编写 e2e 脚本验证“管理员新增智能体 → 用户端刷新 → 初始化成功”全链路。
  - 在 Chrome DevTools 移动端模式验证触摸交互与键盘适配。
- **性能与稳定性**：
  - 监控内存缓存命中率、初始化接口 RT；为上传/录音引入懒加载或动态导入，控制 bundle 体积。
  - 灰度发布：先在预发环境导入 JSON，回放真实流量校验 FastGPT 初始化。
- **观测与告警**：埋点覆盖 CRUD 成功率、初始化成功率、流控使用率；为关键错误设置告警阈值。
- **上线清单**：数据库迁移执行顺序、回滚脚本、管理员培训材料、PRD/技术文档更新。

## 全局注意事项
1. **移动端优先**：侧边抽屉、表单弹窗、骨架屏需在 320px 宽度下验证；录音/上传提示需考虑触摸反馈与安全区域。 【F:frontend/src/components/admin/AdminHome.tsx†L40-L118】【F:frontend/src/components/chat/MessageInput.tsx†L50-L118】
2. **数据唯一可信源**：用户端获取的智能体列表、聊天初始化参数、缓存均来自管理员维护的数据；更新后需广播缓存失效并重新初始化。 【F:frontend/src/hooks/useAgents.ts†L18-L67】【F:backend/src/services/ChatInitService.ts†L25-L134】
3. **安全与合规**：API Key 加密存储；附件上传需配额限制与病毒扫描占位；日志中屏蔽用户隐私与密钥。
4. **零异常策略**：所有后端 API 返回结构化错误码，前端根据 `code` 分流；对不可恢复错误提供联系渠道或重试引导。
5. **轻量与性能**：优先使用原生或轻量库，录音/波形组件按需加载，骨架屏与动效遵循 60fps 限制。
6. **版本兼容**：Zustand 持久化迁移提供前后兼容转换；数据库迁移提供回滚 SQL，确保失败可恢复。

## 交付物清单
- 数据库迁移脚本、智能体治理服务与缓存策略说明。
- 管理端 CRUD UI、批量导入工具、操作审计与权限策略。
- 完整的聊天历史 API、多模态输入与流控能力实现。
- 自动化测试、手动回归脚本、性能与观测仪表板。
- 上线运行手册，包含应急预案与运维注意事项。
