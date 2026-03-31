# EasyChat for Edge

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![Edge Extension](https://img.shields.io/badge/Edge-Extension-blue?logo=microsoftedge)](https://www.microsoft.com/edge)
[![Chrome Compatible](https://img.shields.io/badge/Chrome-Compatible-yellow?logo=googlechrome)](https://www.google.com/chrome/)

[中文说明](README_CN.md)

A free, open-source AI chat assistant browser extension for Microsoft Edge and Google Chrome. Connect to 200+ AI models — ChatGPT, Claude, Gemini, DeepSeek, Llama, Qwen, and more — all from your browser sidebar, popup, or full window. No server required, no account needed, just bring your own API key.

<!-- Screenshot placeholder: replace with actual screenshot -->
<!-- ![Screenshot](screenshots/demo.png) -->

## Why EasyChat?

- **One extension, all models** — switch between GPT, Claude, Gemini, DeepSeek and 200+ others without leaving your browser
- **Privacy first** — your API key stays in your browser, nothing goes through our servers
- **Zero dependencies** — pure JavaScript, no Node.js, no npm, no build step
- **Works offline-ready** — once loaded, the extension runs entirely in your browser

## Supported AI Models

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-5.x, GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo, o1, o1-mini, o3-mini |
| **Anthropic** | Claude 4.6 Opus, Claude 4.6 Sonnet, Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash |
| **DeepSeek** | DeepSeek Chat, DeepSeek Reasoner, DeepSeek R1, DeepSeek V3, DeepSeek Coder |
| **Chinese AI** | Qwen (通义千问), GLM (智谱), ERNIE (文心一言), Spark (讯飞星火), Doubao (豆包), Moonshot (月之暗面), Yi (零一万物) |
| **Open Source** | Llama 3, Mistral, Mixtral, Qwen, Yi, Phi, Command R |
| **Local** | Ollama, LM Studio, vLLM, LocalAI, text-generation-webui |
| **Any** | Any OpenAI-compatible API endpoint |

## Features

### AI Chat
- Real-time streaming responses with live Markdown rendering
- Code syntax highlighting with one-click copy
- Conversation history — save, search, continue previous chats
- Multiple profiles — different API keys, models, and parameters per profile
- Custom avatars for user and AI
- Chinese / English bilingual interface
- Popup, sidebar, and full-window modes

### Selection Tools
- Select any text on any webpage to get a floating action toolbar
- **Ask AI** — ask questions about selected text
- **Rewrite** — rephrase, improve, or change tone
- **Translate** — inline translation bubble with highlighted source text
- **Summarize** — get a quick summary
- **Annotate** — pin notes to any part of a page
- **Copy** — one-click copy

### Browser Agent
- Control your browser with natural language
- Click buttons, fill forms, scroll pages, navigate
- Ask questions about your recent browsing history
- Smart routing — automatically decides between chat and browser action

### Web Search Integration
- Tavily, Serper (Google), SerpAPI, Bing Search, Brave Search
- Custom search API support
- AI answers grounded in real-time web results

### Page Tools
- Screenshot conversations
- Auto-annotate and highlight page content
- Summarize entire web pages
- Source highlighting — click to locate where AI's answer came from

### Advanced Parameters
- Temperature, Top P, Frequency Penalty, Presence Penalty
- Max token limit, context message limit
- Token usage statistics per model

## Installation

1. Clone or download this repository
2. Open Edge and go to `edge://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the project folder
5. Click the extension icon to start

> Works on Chrome too — load it at `chrome://extensions/`.

## Configuration

1. Click **Settings** in the sidebar
2. Enter your API Base URL (optional) and API Key
3. Choose a model and start chatting

### Multiple Profiles
Create separate profiles for different providers — e.g. one for OpenAI, one for Claude, one for a local Ollama instance.

### Web Search
Select a search provider in AI Parameters, enter the API key, and toggle the 🌐 button to enable search-augmented answers.

## Tech Stack

- Manifest V3 browser extension
- Pure JavaScript — zero npm dependencies, no build step
- Chrome Storage API for data persistence
- Marked.js for Markdown rendering
- Server-Sent Events (SSE) for streaming

## Contributing

Contributions welcome! Fork, branch, commit, and open a PR.

## License

[MIT](LICENSE)

## Keywords

`edge extension` `chrome extension` `chatgpt extension` `claude extension` `gemini extension` `ai assistant` `browser ai` `ai chat` `ai sidebar` `gpt browser` `llm client` `openai client` `anthropic client` `deepseek client` `ai translation` `ai summarizer` `ai rewriter` `browser agent` `web search ai` `ollama gui` `lm studio client` `free ai extension` `open source ai chat` `manifest v3` `chatgpt alternative` `ai browser extension` `multi model ai` `ai copilot` `ai productivity` `qwen` `llama` `mistral`
