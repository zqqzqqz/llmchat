# LLMChat 项目规则

## 项目愿景
打造一个安全、高效、可扩展的 LLM 对话系统，支持多模型接入、知识库管理、多轮对话、流式输出、插件化扩展，并具备企业级监控与审计能力。

## 1. 架构原则
- 前后端分离：前端负责 UI/UX，后端负责业务与模型调用，通过 REST & WebSocket 通信。
- 插件化：任何模型、知识源、工具、输出渲染器都以插件形式注册，可热插拔。
- 配置即代码：所有可配置项（模型参数、路由策略、限流阈值）统一收敛到 `config/` 目录，支持环境变量覆盖。
- 零信任安全：每次调用都经过身份校验 + 权限校验 + 审计日志，敏感字段脱敏落地。
- 可观测性：全链路 Trace（OpenTelemetry）、指标（Prometheus）、日志（结构化 JSON）三位一体。


## 2. 目录规范
- 一级目录仅允许 `cmd/`、`internal/`、`pkg/`、`api/`、`config/`、`scripts/`、`docs/`、`test/`、`build/`、`deploy/`，新增需经架构评审。
- 所有业务代码必须位于 `internal/` 下，按“限界上下文”划分子域，子域内再分 `domain/`、`application/`、`infrastructure/`、`interfaces/` 四层，禁止跨层 import。
- 插件源码统一放在 `internal/plugins/{type}/{name}/`，必须提供 `manifest.yaml` 与 `README.md`，并在 `internal/plugins/registry.go` 注册。
- 配置文件统一收敛到 `config/`；`config/default/` 存放默认值，`config/example/` 提供示例；禁止在代码中硬编码任何配置项。
- 脚本与工具只能放在 `scripts/` 或 `build/`；`scripts/` 面向开发（生成、调试），`build/` 面向 CI/CD（打包、镜像），禁止散落他处。
- 测试代码与业务代码同目录并列 `*_test.go`，集成测试必须放在 `test/integration/`；单元测试覆盖率 ≥80%，集成测试用例需在 `test/README.md` 登记。
- 所有 `.proto` 文件置于 `api/proto/`，生成的代码禁止手动修改；变更需通过 `buf breaking` 检测，确保向后兼容。
- 日志、缓存、数据库迁移文件分别放在 `internal/infrastructure/logs/`、`internal/infrastructure/cache/`、`internal/infrastructure/db/migrations/`，按日期+序号命名，禁止随意移动。
- 任何目录新增、删除、重命名均需同步更新 `docs/directory_layout.md` 并在 PR 中说明，否则 CI 拒绝合并。
## 3. 开发规范
### 3.1 代码风格
- 统一使用 `gofmt` 格式化，禁止手动调整缩进与括号风格；提交前必须执行 `make fmt-check`，否则 CI 拒绝。
- 每行最长 120 字符，超长强制换行，换行位置以“语义完整”优先，禁止在逗号后立即换行。
- 变量命名：公开接口用 `PascalCase`，私有用 `camelCase`，常量用 `UPPER_SNAKE_CASE`，缩写必须全大写（如 `HTTPClient`）。
- 函数长度 ≤60 行，圈复杂度 ≤10，超出需在函数头注释 `// complexity: xx` 并 @code-reviewer 评审。
- 错误处理：禁止裸 `panic`，所有错误必须 `wrap` 并带上 `op=函数名` 标签，最终通过 `internal/pkg/errors` 统一序列化返回。
- 日志打印：统一使用 `internal/infrastructure/logs` 包，禁止 `fmt.Print*`；日志字段必须 `key=value` 格式，敏感字段用 `***` 脱敏。
- 注释规范：公开函数必须写 `// FuncName 简要描述，超过一句用句号结尾`，参数与返回值在代码中自解释即可；复杂算法需另起 `// 说明:` 段落。

### 3.2 Git 提交
- 分支模型：`main` 仅接受合并，开发从 `main` 切 `feature/{Jira-ID}-{简短描述}`，热修复切 `hotfix/{Jira-ID}`。
- 提交信息格式：
  ```
  <type>(<scope>): <subject>  # 50 字内，句首大写，无句号
  
  <body>  # 可选，72 字换行，说明"原因"与"做法"
  
  <footer>  # 可选，关联 Jira/需求单，如 Fixes #123
  ```
  type 仅允许：feat/fix/docs/style/refactor/test/chore；scope 为限界上下文或插件名。
- 提交原子性：一次提交仅完成一个最小功能点，禁止混合无关变更；CI 失败需 `git rebase -i` 压缩修正。
- 强制签名：所有提交必须 `git commit -S`，未签名推送将被服务器拒绝。
- 合并策略：仅允许“Squash Merge”回 main，合并前须通过 Code Review + CI 全绿 + 覆盖率不下降。

## 4. 安全规范
- 密钥与令牌：禁止将任何 `AK/SK、JWT Secret、DB 密码` 写入代码或日志；统一走 `KMS/ Vault` 或环境变量注入，代码中仅留占位符 `{{VAULT:key}}`。
- 输入校验：所有外部入参（HTTP、gRPC、WebSocket、插件）必须经 `internal/pkg/validator` 做「白名单+长度+正则」三重校验，拒绝任何隐式转换。
- SQL/NoSQL：强制使用参数化查询或 ORM，禁止拼接；敏感字段（身份证、银行卡）落库前须 `AES-256-GCM` 加密，密钥轮换周期 ≤90 天。
- 依赖扫描：CI 阶段必须执行 `nancy / snyk`，高危漏洞 ≥HIGH 需在 24h 内修复或提供豁免评审记录。
- 审计日志：用户级操作（登录、提问、知识库增删）必须写 `audit_log` 表，保留 ≥3 年，字段包括 `who、when、what、ip、user_agent`，禁止 UPDATE/DELETE。

## 5. 性能与容量
- 接口 RT：P99 ≤500 ms，超时统一 5 s；超过阈值自动触发 `internal/infrastructure/circuitbreaker` 降级，返回 `429` 并带 `Retry-After`。
- 并发限流：按「用户+模型+知识库」三维配额，令牌桶算法，默认 `60 req/min、600 req/hour、6000 req/day`，支持运行时动态调整。
- 批量调用：单次问答链涉及 ≥3 次 LLM 请求时必须改走 `bulk` 接口，减少网络往返；批量大小 ≤32，失败重试指数退避。
- 缓存策略：热点知识片段缓存 `Redis` TTL=15 min，版本号变化时主动失效；缓存 Key 必须带 `v{schema_version}`，防止灰度污染。
- 资源上限：容器内存 ≤4 GiB，GPU 显存 ≤10 GiB；OOM 触发自动 dump `heap / gpu` 到 `s3://llmchat-dump/` 并报警。

## 6. 数据与隐私
- 数据分级：按 `公开/内部/机密/绝密` 四档打标，存储、传输、备份策略差异执行；机密以上走 `TLS 1.3 + mTLS`。
- 数据脱敏：日志、监控、错误堆栈中凡出现手机号、邮箱、身份证，一律用 `***` 替换中间位；脱敏函数统一在 `internal/pkg/desensitize`。
- 数据跨境：用户问答原始语料禁止出境；如需海外模型推理，须先经 `internal/pkg/filter` 做关键词+语义双重清洗，并走审批流。
- 被遗忘权：提供 `DELETE /api/v1/users/{id}/data` 接口，7 天内完成全量副本擦除（含备份），返回 `208 Already Reported` 供第三方同步。
- 训练隔离：线上语料仅用于「即时推理」，如需二次训练须走「匿名化+抽样+人工复核」三板斧，抽样率 ≤1%，并出《数据使用声明》。

## 7. 发布与回滚
- 灰度策略：按「地域→用户尾号→模型」三阶段，灰度比例 1%→10%→50%→100%，每阶段观察 ≥30 min，错误率 >1% 立即回滚。
- 版本号：遵循 `v{major}.{minor}.{patch}-{build}`，其中 `minor` 奇数为预发布；镜像 tag 与 Git tag 强制一致，禁止 `latest`。
- 数据库回滚：表结构变更必须带 `DOWN` 脚本，并验证 `ROLLBACK` 耗时 ≤5 min；大表加索引使用 `pt-online-schema-change`。
- 配置回滚：支持「秒级」配置热回滚，通过 `config/version/{v}` 快照机制，回滚命令 `make config-rollback v=xx`。
- 事故模板：产生 P2 及以上事故，需在 24 h 内提交《5W1H 复盘报告》到 `docs/incident/`，并同步更新「错误码字典」。

## 8. 文档与知识沉淀
- 文档即代码：`docs/` 下所有 `.md` 须通过 `mkdocs` 构建，PR 中改动 ≥20 行必须同步更新 `docs/SUMMARY.md`。
- 接口文档：`.proto` 变更后自动同步到 `api/apidocs.swagger.json`，前端可实时预览；示例请求/响应必须可一键导入 Postman。
- 架构图：使用 `C4 Model`，源文件存 `docs/diagrams/`，输出 `png + puml` 双格式，禁止贴静态图片；Review 时需 diff 图。
- 知识库：FAQ、踩坑、性能调优案例统一沉淀到 `docs/kb/`，文件命名 `KB{yyyyMMdd}-{主题}.md`，并打标签 `#模型 #缓存 #限流`。
- 新人指引：维护 `docs/onboarding/30min-tutorial.md`，保证新同事 30 min 可本地跑通「问答+知识库+插件」全链路，每季度验收一次。
