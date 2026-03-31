# EasyChat for Edge

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![Edge 扩展](https://img.shields.io/badge/Edge-扩展-blue?logo=microsoftedge)](https://www.microsoft.com/edge)
[![Chrome 兼容](https://img.shields.io/badge/Chrome-兼容-yellow?logo=googlechrome)](https://www.google.com/chrome/)

[English](README.md)

免费开源的 AI 聊天助手浏览器扩展，支持 Microsoft Edge 和 Google Chrome。一个插件连接 200+ AI 大模型 —— ChatGPT、Claude、Gemini、DeepSeek、通义千问、文心一言、Llama 等等。无需服务器，无需注册账号，填入你自己的 API Key 即可使用。

<!-- 截图占位：替换为实际截图 -->
<!-- ![截图](screenshots/demo.png) -->

## 为什么选 EasyChat？

- **一个扩展，所有模型** —— 在 GPT、Claude、Gemini、DeepSeek 等 200+ 模型之间自由切换
- **隐私优先** —— API Key 只存在你的浏览器里，不经过任何第三方服务器
- **零依赖** —— 纯 JavaScript，不需要 Node.js、npm、不需要编译
- **本地运行** —— 加载后完全在浏览器内运行

## 支持的 AI 模型

| 厂商 | 模型 |
|------|------|
| **OpenAI** | GPT-5.x, GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo, o1, o1-mini, o3-mini |
| **Anthropic** | Claude 4.6 Opus, Claude 4.6 Sonnet, Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash |
| **DeepSeek** | DeepSeek Chat, DeepSeek Reasoner, DeepSeek R1, DeepSeek V3, DeepSeek Coder |
| **国产大模型** | 通义千问 (Qwen), 智谱清言 (GLM), 文心一言 (ERNIE), 讯飞星火 (Spark), 豆包 (Doubao), 月之暗面 (Moonshot/Kimi), 零一万物 (Yi) |
| **开源模型** | Llama 3, Mistral, Mixtral, Qwen, Yi, Phi, Command R |
| **本地部署** | Ollama, LM Studio, vLLM, LocalAI, text-generation-webui |
| **自定义** | 任何兼容 OpenAI API 格式的接口 |

## 功能特性

### AI 对话
- 流式实时输出，Markdown 实时渲染
- 代码高亮 + 一键复制
- 对话历史管理 —— 保存、搜索、继续之前的对话
- 多配置文件 —— 不同的 API Key、模型、参数独立管理
- 自定义用户和 AI 头像
- 中文 / 英文双语界面
- 弹窗、侧边栏、全窗口三种模式

### 划词工具栏
- 在任意网页选中文字，弹出浮动操作栏
- **问 AI** —— 针对选中内容提问
- **改写** —— 润色、改写、换语气
- **翻译** —— 行内翻译气泡，原文蓝色高亮标记
- **总结** —— 快速摘要
- **标注** —— 在页面任意位置钉注释
- **复制** —— 一键复制

### 浏览器智能体
- 用自然语言控制浏览器
- 点击按钮、填写表单、滚动页面、打开网页
- 查询和对比最近的浏览历史
- 智能路由 —— 自动判断是聊天还是浏览器操作

### 联网搜索
- 支持 Tavily、Serper (Google)、SerpAPI、Bing 搜索、Brave 搜索
- 支持自定义搜索 API
- AI 回答基于实时网络搜索结果

### 页面工具
- 对话截图
- 自动标注和高亮页面内容
- 一键总结整个网页
- 来源定位 —— 点击查看 AI 回答引用的原文位置

### 高级参数
- Temperature、Top P、频率惩罚、存在惩罚
- 最大 Token 限制、上下文消息条数限制
- 按模型统计 Token 用量

## 安装

1. 克隆或下载本仓库
2. 打开 Edge 浏览器，进入 `edge://extensions/`
3. 开启**开发者模式**
4. 点击**加载解压缩的扩展**，选择项目文件夹
5. 点击扩展图标即可使用

> 也支持 Chrome —— 在 `chrome://extensions/` 加载即可。

## 配置

1. 点击侧边栏的**设置**
2. 填入 API Base URL（可选）和 API Key
3. 选择模型，开始聊天

### 多配置文件
为不同的 AI 厂商创建独立配置 —— 比如一个用 OpenAI，一个用 Claude，一个连本地 Ollama。

### 联网搜索
在 AI 参数中选择搜索引擎，填入对应 API Key，点击 🌐 按钮开启搜索增强回答。

## 技术栈

- Manifest V3 浏览器扩展
- 纯 JavaScript —— 零 npm 依赖，无需构建
- Chrome Storage API 数据持久化
- Marked.js Markdown 渲染
- Server-Sent Events (SSE) 流式传输

## 参与贡献

欢迎贡献！Fork 本仓库，创建分支，提交 PR 即可。

## 许可证

[MIT](LICENSE)

## 关键词

`Edge扩展` `Chrome扩展` `浏览器AI助手` `ChatGPT插件` `Claude插件` `Gemini插件` `DeepSeek插件` `AI聊天` `AI翻译` `AI总结` `AI改写` `划词翻译` `划词提问` `浏览器AI` `大模型客户端` `OpenAI客户端` `免费AI插件` `开源AI聊天` `通义千问` `文心一言` `智谱清言` `讯飞星火` `豆包` `Kimi` `月之暗面` `Ollama客户端` `LM Studio` `本地大模型` `AI浏览器扩展` `多模型AI` `AI生产力工具` `AI侧边栏` `网页AI助手` `联网搜索AI` `浏览器智能体`
