#!/bin/bash

# LLMChat 开发环境启动脚本

echo "🚀 启动 LLMChat 开发环境..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js (v18+)"
    exit 1
fi

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

echo "📦 安装根目录依赖..."
npm install

echo "📦 安装后端依赖..."
cd backend && npm install
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi

echo "📦 安装前端依赖..."
cd ../frontend && npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi

cd ..

echo "✅ 所有依赖安装完成！"

echo "🌟 智能体切换功能包含以下特性:"
echo "   - 多智能体动态切换 (FastGPT、OpenAI、Anthropic)"
echo "   - 主题切换 (白天/夜晚/自动)"
echo "   - 流式响应处理"
echo "   - 服务端配置管理"
echo "   - 响应式界面设计"

echo ""
echo "📋 启动命令:"
echo "   开发环境: npm run dev"
echo "   后端服务: npm run backend:dev" 
echo "   前端服务: npm run frontend:dev"
echo "   构建项目: npm run build"

echo ""
echo "⚙️  配置说明:"
echo "   1. 复制 config/agents.json 并配置您的智能体API密钥"
echo "   2. 修改 backend/.env 中的配置选项"
echo "   3. 前端会自动代理到后端 API (localhost:3001)"

echo ""
echo "🎯 现在可以运行 'npm run dev' 启动完整应用！"