# FastGPT 接入优化工作计划

## 目标

1. **事件解析零遗漏**：确保 FastGPT 返回的所有事件（含未来新增的别名）都能被后端捕获并流转到前端，同时避免重复渲染和信息丢失。
2. **思维链体验对齐通义千问**：在聊天界面中以时间线形式展示实时思维链，让用户先看到“思考过程”再阅读正式回答。
3. **高可用与高并发**：通过缓存、请求合并与事件抽象减少 FastGPT 接口压力，为后续横向扩展打下基础。
4. **工程一致性**：统一前后端对事件的识别逻辑，降低维护成本，保证功能演进时的同步性。

## 已完成工作

- **事件模式抽象**：引入 `fastgptEvents` 模块，以正则模式匹配方式识别 reasoning、工具、知识库、usage、结束、交互等事件，自动覆盖 `reasoning_content`、`flow.status`、`workflow.end` 等别名，无需反复手动补充枚举值。【F:backend/src/utils/fastgptEvents.ts†L1-L59】【F:frontend/src/lib/fastgptEvents.ts†L1-L59】
- **后端流式调度升级**：`ChatProxyService` 现使用统一的事件分类器，在记录日志、下发 SSE、合并分支时保持一致逻辑，并继续透传原始 payload 供前端渲染时间线与思维链。【F:backend/src/services/ChatProxyService.ts†L14-L23】【F:backend/src/services/ChatProxyService.ts†L538-L609】
- **前端事件消费统一**：流式消费与事件时间线渲染复用同一套分类函数，实现“思维链优先展示 + 事件轨迹”的通义风格，并避免因新事件命名差异导致的漏报或重复展示。【F:frontend/src/services/api.ts†L21-L48】【F:frontend/src/services/api.ts†L205-L309】【F:frontend/src/lib/events.ts†L1-L102】
- **未知事件兜底策略**：对于无法提取摘要的事件自动忽略，既避免噪音，又保留可视化潜力；对于 reasoning 类事件则统一走思维链组件展示，提高信息聚合度。【F:frontend/src/lib/events.ts†L72-L102】
- **fastgptEvents 单元测试**：新增 Jest 测试覆盖多种别名、大小写与符号组合，确保分类逻辑在新增字段时保持稳定。【F:backend/jest.config.ts†L1-L11】【F:backend/src/utils/__tests__/fastgptEvents.test.ts†L1-L61】
- **事件观测出口打通**：`ChatLogService` 与 `ObservabilityDispatcher` 支持按批推送至 Elasticsearch、ClickHouse 或 HTTP Webhook，提供批量大小与刷新间隔配置，满足企业级可观测需求。【F:backend/src/services/ObservabilityDispatcher.ts†L1-L138】【F:backend/src/services/ChatLogService.ts†L1-L140】【F:config/config.jsonc†L6-L25】
- **自适应缓存策略**：通过 `AdaptiveTtlPolicy` 动态调整 FastGPT 初始化与历史接口缓存 TTL，基于命中率自动扩缩时长，兼顾高并发与实时性。【F:backend/src/utils/adaptiveCache.ts†L1-L54】【F:backend/src/services/ChatInitService.ts†L1-L209】【F:backend/src/services/FastGPTSessionService.ts†L1-L324】
- **思维链 / 事件时间线折叠**：ReasoningTrail 与 EventTrail 增加折叠与增量加载，在保持 Tongyi 式视觉的同时降低长推理链渲染成本。【F:frontend/src/components/chat/ReasoningTrail.tsx†L1-L167】【F:frontend/src/components/chat/EventTrail.tsx†L1-L96】

## 后续优先级

1. **观测指标回流**：结合新导出的日志事件，补齐投递耗时、失败率等指标，并配置异常告警阈值，形成完整的 SLO 闭环。
2. **历史事件回放调试**：基于缓存与事件快照提供“逐步重放”能力，方便定位复杂会话的执行分支与外部调用差异。
3. **性能压测与资源评估**：针对自适应缓存与前端折叠策略开展高并发压测，评估 CPU/内存曲线并形成扩容建议。

> 若需扩展新的事件类型，仅需在 `fastgptEvents` 模块补充匹配模式或在 `EVENT_METADATA` 中新增标签，无需改动其它业务逻辑。

