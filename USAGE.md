# LLMChat 使用说明

## 📖 项目简介

LLMChat 是一个仿照 ChatGPT 官网的智能体切换功能的聊天应用，支持在多个 AI 提供商（FastGPT、OpenAI、Anthropic 等）之间进行动态切换。

## ✨ 主要功能

- 🤖 **多智能体动态切换**: 支持 FastGPT、OpenAI、Anthropic 等多个 AI 提供商
- 🌙 **主题切换**: 支持白天模式、夜晚模式和自动模式
- 💬 **流式响应**: 实时流式消息响应，提升用户体验
- 🔧 **服务端配置**: 统一的智能体配置管理
- 📱 **响应式设计**: 适配各种屏幕尺寸
- 💾 **状态持久化**: 自动保存用户偏好和聊天记录

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 yarn
- 支持现代浏览器

### 安装步骤

1. **克隆或下载项目**
   ```bash
   git clone [repository-url]
   cd llmchat
   ```

2. **运行安装脚本**
   
   Windows:
   ```bash
   setup.bat
   ```
   
   Linux/macOS:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **配置智能体**
   
   编辑 `config/agents.json` 文件，配置您的 API 密钥:
   ```json
   {
     "agents": [
       {
         "id": "fastgpt-assistant",
         "name": "FastGPT 智能助手",
         "apiKey": "您的-FastGPT-API-密钥",
         "endpoint": "您的-FastGPT-端点",
         ...
       }
     ]
   }
   ```

4. **启动应用**
   ```bash
   npm run dev
   ```

   应用将在以下地址启动：
   - 前端: http://localhost:3000
   - 后端: http://localhost:3001

## 📁 项目结构

```
llmchat/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 业务服务  
│   │   ├── routes/         # 路由定义
│   │   ├── middleware/     # 中间件
│   │   ├── types/          # TypeScript 类型
│   │   └── utils/          # 工具函数
│   ├── package.json
│   └── .env                # 环境变量
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── hooks/          # 自定义 Hooks
│   │   ├── store/          # 状态管理
│   │   ├── services/       # API 服务
│   │   ├── types/          # TypeScript 类型
│   │   └── styles/         # 样式文件
│   ├── package.json
│   └── vite.config.ts      # Vite 配置
├── config/                 # 配置文件
│   └── agents.json         # 智能体配置
├── doc/                    # 文档
└── README.md
```

## ⚙️ 配置说明

### 智能体配置

在 `config/agents.json` 中配置智能体:

```json
{
  "id": "unique-agent-id",
  "name": "显示名称",
  "description": "智能体描述", 
  "endpoint": "API 端点 URL",
  "apiKey": "API 密钥",
  "model": "模型名称",
  "provider": "fastgpt|openai|anthropic|custom",
  "isActive": true,
  "features": {
    "supportsStream": true,
    "supportsFiles": false,
    ...
  }
}
```

### 环境变量

后端环境变量 (backend/.env):

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
AGENTS_CONFIG_PATH=../config/agents.json
REQUEST_TIMEOUT=30000
```

## 🎯 使用指南

### 切换智能体

1. 点击顶部的智能体选择器
2. 从下拉列表中选择您想要使用的智能体
3. 智能体状态指示器显示当前可用性

### 主题切换

1. 点击右上角的主题切换按钮
2. 支持三种模式：
   - ☀️ 白天模式
   - 🌙 夜晚模式  
   - 🖥️ 自动模式（根据时间自动切换）

### 聊天功能

1. 在底部输入框中输入您的问题
2. 按 Enter 或点击发送按钮
3. 支持流式响应实时显示回答

## 🔧 开发命令

```bash
# 同时启动前后端开发服务
npm run dev

# 只启动后端
npm run backend:dev

# 只启动前端  
npm run frontend:dev

# 构建生产版本
npm run build

# 类型检查
npm run type-check

# 代码格式检查
npm run lint
```

## 🌟 技术栈

### 后端
- **Node.js + Express**: 后端框架
- **TypeScript**: 类型安全
- **Axios**: HTTP 客户端
- **Joi**: 数据验证

### 前端
- **React 18**: UI 框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具
- **Tailwind CSS**: 样式框架
- **Zustand**: 状态管理
- **Lucide React**: 图标库

## 🔍 故障排除

### 常见问题

1. **端口被占用**
   - 修改 `.env` 文件中的端口配置
   - 或使用 `PORT=3002 npm run dev` 指定端口

2. **API 请求失败**
   - 检查智能体配置中的 API 密钥和端点
   - 确认网络连接正常

3. **构建失败**
   - 清除 node_modules 重新安装依赖
   - 检查 Node.js 版本是否符合要求

### 调试模式

设置环境变量启用详细日志:
```bash
NODE_ENV=development npm run dev
```

## 📞 技术支持

如果遇到问题，请：

1. 查看控制台错误信息
2. 检查网络连接和 API 配置
3. 查看项目文档和配置说明

## 📝 更新日志

### v1.0.0
- 🎉 初始版本发布
- ✅ 支持多智能体切换
- ✅ 主题系统实现
- ✅ 流式响应处理
- ✅ 状态持久化