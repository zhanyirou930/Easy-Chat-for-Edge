# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyChat for Edge is a Microsoft Edge browser extension (Manifest V3) that provides an AI chat interface supporting 200+ models (OpenAI, Anthropic, Google, DeepSeek, Grok, local models via Ollama/LM Studio, and any OpenAI-compatible API). Zero build tooling — pure vanilla JS, no npm, no bundler.

## Loading & Testing

Load as unpacked extension at `edge://extensions/` with Developer mode enabled. After editing files, reload the extension and hard-refresh (Ctrl+Shift+R) any open extension pages. Use the Edge DevTools console (F12) on extension pages for debugging — logs are prefixed with `[GPT]`.

## Architecture

### Entry Points (three independent UIs sharing the same storage)

- **Popup** (`popup.html` + `popup.js`) — opens when clicking the extension icon; lightweight quick-chat (420×600 popup window)
- **Full Window** (`chat.html` + `chat.js`) — full-featured chat with sidebar, settings, profiles, statistics; opened from popup or via `background.js`
- **Sidebar** (`sidebar.html`) — Edge side panel integration

Each entry point maintains its own session ID (`currentPopupSessionId`, `currentId`, `currentSidebarSessionId`). Session sync is "open once, then independent" — when one entry opens another, the current session is passed once, then they diverge.

### Core Files

| File | Role |
|---|---|
| `background.js` | Service worker: window management, message routing between entry points, stream relay, browser history search, screenshot capture, agent task orchestration |
| `shared-core.js` | IIFE exporting `SharedCore` to `globalThis` — shared utilities (HTML escaping, URL normalization, content builders, context source helpers, display text formatting) |
| `content.js` | Content script injected into all pages — selection menu (Ask AI, Rewrite, Translate, Summarize, Annotate), inline translation bubbles, page annotation |
| `marked.min.js` | Marked v15.0.12 — markdown rendering with GFM mode |

### Data Flow

1. All persistent state lives in `chrome.storage.local` — keys: `sessions`, `config`, `profiles`, `currentProfile`, `tokenUsage`, `currentId`, `currentPopupSessionId`, avatars (Base64)
2. AI requests go through OpenAI-compatible `/v1/chat/completions` endpoint (streaming via SSE by default). `shared-core.js:normalizeBaseUrl()` appends `/v1` if missing.
3. Streaming chunks are relayed through `background.js` using `chrome.runtime.sendMessage` — the background service worker bridges between entry points via message types (e.g., `STREAM_CHUNK`, `STREAM_END`, `OPEN_CHAT_SESSION`).
4. `chrome.storage.onChanged` listener in each entry point reacts to cross-entry storage mutations.

### Markdown Rendering Pipeline

`renderMarkdown(text)` → `buildRenderedMarkdownHtml(text)` → `marked.parse()` with `{ breaks: true, gfm: true }` → post-process code blocks (copy buttons, language labels) → `bindMarkdownInteractions()` (sets `target="_blank"` on all links). A `protectUrls()` pre-pass wraps bare URLs in `< >` to prevent markdown special chars inside URLs (like `**`) from being parsed as formatting. Render cache: `markdownRenderCache` (Map, limit 120).

### i18n

Inline `translations` object in `chat.js` and `popup.js` with `zh`/`en` keys. `t(key)` function for lookup, falls back to Chinese. Language stored in `config.language`.

### Reasoning Model Support

Special handling for o1, o3, DeepSeek Reasoner, Grok reasoning models — reasoning transcript extraction, thinking indicator UI, and heading-to-page mapping in `REASONING_HEADING_PAGES`.

## Key Conventions

- All inter-component communication uses `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` with a `type` field for routing.
- `shared-core.js` is loaded via `importScripts()` in background.js and via `<script>` tag in HTML pages — it attaches to `globalThis.SharedCore`.
- `save()` persists `sessions`, `tokenUsage`, and `currentId` to storage. `saveCurrentId()` persists only `currentId`.
- Web search is toggled per-session via the globe button; search provider configured in settings (`config.searchEngine`, `config.searchApiKey`).
