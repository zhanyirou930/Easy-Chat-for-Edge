// popup.js — 与完整界面完全共用数据

let config = {};
let sessions = [];
let currentId = null;
let streaming = false;
let abortController = null;
let pendingScreenshot = null;
let pendingScreenshotMeta = null;
let autoScroll = true;
let pendingContext = null;
let webSearchEnabled = false;
let hostWindowId = null;
const isSidePanelPage = /sidebar\.html$/i.test(location.pathname);
const sessionStorageKey = isSidePanelPage ? 'currentSidebarSessionId' : 'currentPopupSessionId';
let typingFlipState = null;
const REASONING_HEADING_PAGES = {
  'persona setup': ['检查角色设定', '核对上下文约束'],
  'parsing user persona': ['解析用户设定', '提炼角色要求'],
  'handling greeting': ['处理开场招呼', '准备回应语气'],
  'handling greetings': ['处理开场招呼', '准备回应语气'],
  'handling repeat greeting': ['识别重复招呼', '调整回复方式'],
  'refusing jailbreak': ['校验安全边界', '避免越权响应'],
  'refusing persona change': ['保持默认身份', '拒绝角色切换'],
  'deciding on role-play': ['评估角色扮演', '确认回应范围'],
  'drafting a fresh response': ['整理回复结构', '生成自然表达'],
  'joking about': ['补一点幽默感', '让语气更轻一点'],
  'acknowledge the repeat': ['识别上下文重复', '避免机械复述'],
  'thinking about your request': ['接收你的请求', '整理回复思路']
};

const quickInput = document.getElementById('quickInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const messagesArea = document.getElementById('messagesArea');

// ── Auto-scroll: stop when user scrolls up ──
messagesArea.addEventListener('scroll', () => {
  const atBottom = messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight < 60;
  autoScroll = atBottom;
});

// ── Init ──
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  hostWindowId = tabs?.[0]?.windowId ?? null;
});

chrome.storage.local.get(['profiles', 'currentProfile', 'sessions', 'currentPopupSessionId', 'currentSidebarSessionId', 'currentId', 'pendingScreenshot', 'pendingPageAction', 'config', 'webSearchEnabled'], (data) => {
  const profiles = data.profiles || {};
  const profileName = data.currentProfile || 'default';
  const profile = profiles[profileName] || {};
  const savedConfig = data.config || {};

  config = {
    baseUrl: profile.baseUrl || '',
    apiKey: profile.apiKey || '',
    model: profile.model || 'gpt-4o',
    systemPrompt: profile.systemPrompt || '',
    temperature: profile.temperature ?? 0.7,
    topP: profile.topP ?? 1.0,
    frequencyPenalty: profile.frequencyPenalty ?? 0.0,
    presencePenalty: profile.presencePenalty ?? 0.0,
    maxTokens: profile.maxTokens || '',
    streamEnabled: profile.streamEnabled ?? true,
    userAvatar: profile.userAvatar || '',
    aiAvatar: profile.aiAvatar || '',
    language: savedConfig.language || profile.language || 'zh',
    searchEngine: profile.searchEngine || savedConfig.searchEngine || 'tavily',
    searchApiKey: profile.searchApiKey || savedConfig.searchApiKey || '',
    customSearchUrl: profile.customSearchUrl || savedConfig.customSearchUrl || '',
  };

  // Apply language
  const langSelect = document.getElementById('langSelect');
  if (langSelect) langSelect.value = config.language;
  applyLanguage(config.language);

  updateStatus();

  sessions = data.sessions || [];
  currentId = data[sessionStorageKey] || (isSidePanelPage ? data.currentPopupSessionId : null) || sessions[0]?.id || null;
  if (currentId && !sessions.find(s => s.id === currentId)) currentId = sessions[0]?.id || null;

  renderSessionList();
  if (currentId) loadSession(currentId);

  // Restore web search toggle state
  webSearchEnabled = !!data.webSearchEnabled;
  document.getElementById('btnWebSearch').classList.toggle('active', webSearchEnabled);

  if (data.pendingScreenshot) {
    processPendingScreenshot(data.pendingScreenshot);
  }
  if (data.pendingPageAction) {
    consumePendingPageAction(data.pendingPageAction);
  }
});

function save() {
  chrome.storage.local.set({ sessions, [sessionStorageKey]: currentId });
}

function storageSet(items) {
  return new Promise(resolve => chrome.storage.local.set(items, resolve));
}

let proxyStreaming = false; // true while a PROXY_SEND round-trip is in progress

function processPendingScreenshot(ps) {
  if (!ps) return;
  chrome.storage.local.remove('pendingScreenshot');
  if (typeof ps === 'string') applyPendingScreenshot(ps);
  else if (ps.full && ps.rect) cropAndApply(ps.full, ps.rect);
}

function containsCjk(text) {
  return /[\u3400-\u9fff]/.test(text || '');
}

function guessTranslateTarget(text) {
  return containsCjk(text) ? '英文' : '中文';
}

function buildSelectionContextSource(label, selection) {
  return EasyChatCore.createContextSource('selection', {
    label,
    preview: EasyChatCore.previewText(selection?.text || ''),
    chars: (selection?.text || '').length,
    url: selection?.url,
    title: selection?.title
  });
}

function createSelectionActionContext(action, selection) {
  const text = (selection?.text || '').trim();
  const L = LANG[config.language] || LANG.zh;
  const sourceMeta = (label) => ({
    contextSources: [buildSelectionContextSource(label, selection)],
    autoApplyToPage: !!selection?.editable && (action === 'rewrite' || action === 'translate'),
    sourceTabId: selection?.sourceTabId || null
  });

  if (action === 'rewrite') {
    const label = L.rewriteShortLabel || '改写';
    return {
      type: 'rewrite',
      icon: '✏️',
      label,
      meta: sourceMeta(label),
      promptFn: (userText) =>
        `请改写以下文字，在不改变原意的前提下让表达更清晰、自然、简洁${userText ? `。用户要求：${userText}` : ''}：\n\n${text}`
    };
  }

  if (action === 'translate') {
    const label = L.translateLabel || '翻译';
    const defaultTarget = guessTranslateTarget(text);
    return {
      type: 'translate',
      icon: '🌍',
      label,
      meta: sourceMeta(label),
      promptFn: (userText) =>
        `请将以下文字翻译成${userText || defaultTarget}，只输出译文${userText ? '，如果用户有额外要求请一并满足' : ''}：\n\n${text}`
    };
  }

  if (action === 'summarize_selection') {
    const label = L.summarizeSelectionLabel || '总结';
    return {
      type: 'summarize_selection',
      icon: '🧾',
      label,
      meta: sourceMeta(label),
      promptFn: (userText) =>
        `请总结以下选中内容，提炼核心观点和关键信息，用简洁清晰的中文输出${userText ? `，重点关注：${userText}` : ''}：\n\n${text}`
    };
  }

  const label = L.askLabel || '问 AI';
  return {
    type: 'ask',
    icon: '💬',
    label,
    meta: sourceMeta(label),
    promptFn: (userText) =>
      `请基于以下选中内容回答用户问题${userText ? `。用户问题：${userText}` : '。如果用户没有额外问题，请先概括要点，再给出清晰、直接的回答。'}\n\n选中内容：\n${text}`
  };
}

function consumePendingPageAction(payload) {
  if (!payload?.text) return;
  if ((payload.target || 'side_panel') !== 'side_panel' || !isSidePanelPage) return;
  chrome.storage.local.remove('pendingPageAction');
  pendingContext = createSelectionActionContext(payload.action || 'ask', payload);
  renderContextTag();
  quickInput.focus();
  if (payload.autoSend && !streaming) {
    sendQuick('');
  }
}

// ── Cross-window sync ──
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.pendingScreenshot?.newValue) {
    processPendingScreenshot(changes.pendingScreenshot.newValue);
  }
  if (changes.pendingPageAction?.newValue) {
    consumePendingPageAction(changes.pendingPageAction.newValue);
  }
  const sessionKey = changes[sessionStorageKey]?.newValue;
  if (sessionKey && sessionKey !== currentId && sessions.find(s => s.id === sessionKey)) {
    loadSession(sessionKey);
    return;
  }
  if (streaming || proxyStreaming) return;
  if (!changes.sessions) return;
  const newSessions = changes.sessions.newValue || [];
  const s = sessions.find(x => x.id === currentId);
  const oldCount = s ? s.messages.length : 0;
  sessions = newSessions;
  renderSessionList();
  const updated = sessions.find(x => x.id === currentId);
  if (!updated) return;
  const newCount = updated.messages.length;
  if (newCount > oldCount) {
    for (let i = oldCount; i < newCount; i++) {
      const m = updated.messages[i];
      const bubble = addBubble(m.role === 'assistant' ? 'ai' : 'user', '');
      if (m.role === 'assistant') {
        renderAssistantMessage(bubble, m);
      } else {
        const display = m.display || (typeof m.content === 'string' ? m.content : m.content?.find?.(p => p.type === 'text')?.text || '');
        const imgUrl = Array.isArray(m.content) ? m.content.find(p => p.type === 'image_url')?.image_url?.url : null;
        if (display) renderUserDisplay(bubble, display);
        if (imgUrl) { const img = document.createElement('img'); img.src = imgUrl; img.className = 'msg-img'; bubble.appendChild(img); }
      }
    }
    scrollBottom();
  }
});

// ── Real-time sync from main chat window (CHAT_CHUNK / CHAT_DONE) ──
let chatSyncBubble = null;
let chatSyncSessionId = null;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'CHAT_CHUNK' && msg.type !== 'CHAT_DONE') return;
  if (streaming || proxyStreaming) return; // popup is busy, skip
  if (msg.sessionId !== currentId) return; // different session, skip

  if (msg.type === 'CHAT_CHUNK') {
    if (!msg.full && msg.rawFull) {
      showReasoningPreview(msg.rawFull, msg.model || config.model);
      chatSyncSessionId = msg.sessionId;
      return;
    }
    if (!chatSyncBubble || chatSyncSessionId !== msg.sessionId) {
      chatSyncBubble = ensureAssistantBubble(chatSyncBubble);
      chatSyncSessionId = msg.sessionId;
    }
    renderBubble(chatSyncBubble, msg.full);
    scrollBottom();
  } else if (msg.type === 'CHAT_DONE') {
    if (chatSyncBubble || msg.full) {
      chatSyncBubble = ensureAssistantBubble(chatSyncBubble);
      renderBubble(chatSyncBubble, msg.full);
      scrollBottom();
      chatSyncBubble = null;
      chatSyncSessionId = null;
    }
    // Block onChanged from adding a duplicate bubble, then reload sessions
    proxyStreaming = true;
    chrome.storage.local.get(['sessions'], (data) => {
      if (data.sessions) sessions = data.sessions;
      renderSessionList();
      const updated = sessions.find(x => x.id === currentId);
      if (updated) renderMessages(updated.messages);
      proxyStreaming = false;
    });
  }
});

let backgroundSyncBubble = null;
let backgroundSyncSessionId = null;

function setBackgroundStreamControls(sessionId) {
  backgroundSyncSessionId = sessionId || null;
  if (sessionId) {
    streaming = true;
    proxyStreaming = false;
    abortController = {
      type: 'background',
      sessionId,
      abort() {
        bgMessage({ type: 'STOP_BACKGROUND_STREAM', sessionId }).catch(() => {});
      }
    };
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
  } else if (!proxyStreaming) {
    streaming = false;
    abortController = null;
    sendBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
  }
}

function clearBackgroundStreamUi() {
  backgroundSyncBubble = null;
  backgroundSyncSessionId = null;
  removeTyping();
}

async function restoreBackgroundStreamForCurrentSession() {
  if (!currentId) return;
  const res = await bgMessage({ type: 'GET_ACTIVE_STREAM', sessionId: currentId }).catch(() => null);
  const stream = res?.stream;
  if (!stream) {
    if (backgroundSyncSessionId === currentId) clearBackgroundStreamUi();
    if (!proxyStreaming) setBackgroundStreamControls(null);
    return;
  }

  setBackgroundStreamControls(currentId);
  const visibleText = extractStreamableAnswerText(stream.rawFull, stream.model).trim();
  if (!visibleText) {
    showReasoningPreview(stream.rawFull, stream.model);
    return;
  }

  backgroundSyncBubble = ensureAssistantBubble(backgroundSyncBubble);
  renderBubble(backgroundSyncBubble, visibleText);
  scrollBottom();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'STREAM_CHUNK' && msg.type !== 'STREAM_DONE' && msg.type !== 'STREAM_ERROR') return;
  if (msg.sessionId !== currentId) return;
  if (proxyStreaming) return;

  if (msg.type === 'STREAM_CHUNK') {
    setBackgroundStreamControls(msg.sessionId);
    const visibleText = extractStreamableAnswerText(msg.rawFull, msg.model).trim();
    if (!visibleText) {
      showReasoningPreview(msg.rawFull, msg.model);
      return;
    }
    backgroundSyncBubble = ensureAssistantBubble(backgroundSyncBubble);
    renderBubble(backgroundSyncBubble, visibleText);
    scrollBottom();
    return;
  }

  if (msg.type === 'STREAM_DONE') {
    clearBackgroundStreamUi();
    chrome.storage.local.get(['sessions'], async (data) => {
      if (data.sessions) sessions = data.sessions;
      const updated = sessions.find(x => x.id === currentId);
      if (updated) {
        renderMessages(updated.messages);
        const lastMsg = updated.messages[updated.messages.length - 1];
        await autoApplyAssistantMessageIfNeeded(updated, lastMsg);
      }
      renderSessionList();
      setBackgroundStreamControls(null);
    });
    return;
  }

  clearBackgroundStreamUi();
  setBackgroundStreamControls(null);
  if (!msg.stopped) {
    if (backgroundSyncBubble) {
      backgroundSyncBubble.className = 'msg-bubble';
      backgroundSyncBubble.textContent = '错误: ' + msg.error;
    } else {
      addBubble('ai', '错误: ' + msg.error);
    }
  }
});

function currentSession() {
  return sessions.find(s => s.id === currentId);
}

function appendMessageParts(bubble, content) {
  if (!Array.isArray(content)) return;
  content.forEach(part => {
    if (part.type === 'image_url') {
      const img = document.createElement('img');
      img.src = part.image_url.url;
      img.className = 'msg-img';
      bubble.appendChild(img);
    } else if (part.type === 'file_text') {
      const chip = document.createElement('div');
      chip.className = 'context-tag';
      chip.textContent = `📄 ${part.name}`;
      chip.style.marginTop = '6px';
      bubble.appendChild(chip);
    }
  });
}

// ── Language ──
const LANG = {
  zh: { newChat: '新对话', history: '历史', sidebarUI: '侧边栏 ▕', fullUI: '完整界面 ↗', quickChat: '快速对话', send: '发送消息...', screenshotHint: '描述你想问的问题...', contextHint: '补充说明（可选）...', noApiKey: '未配置 API Key', noApiKeyHint: '请在完整界面设置', askLabel: '问 AI', rewriteShortLabel: '改写', translateLabel: '翻译', summarizeLabel: '总结网页', summarizeSelectionLabel: '总结', rewriteLabel: '改写/翻译', webSearchLabel: '联网搜索', sidebarUnavailable: '当前浏览器不支持扩展侧边栏', sidebarOpenFailed: '打开侧边栏失败', fullOpenFailed: '打开完整界面失败', applyToPage: '回填到页面', applySuccess: '已回填到页面', applyNoTarget: '页面中没有可回填的位置', applySelectionOnly: '当前选中的不是可编辑内容', applyReadOnly: '当前输入框不可编辑', applyBuiltinPage: '浏览器内置页面无法回填', applyFailed: '回填失败', autoApplySuccess: '已自动替换选中文字', askSelectFirst: '请先在页面选中文字', thinkingTitle: 'AI 正在思考', thinkingHint: '请求已发出，正在等待回复', sourceOpened: '已打开来源页面', sourceCopied: '已复制来源摘要', sourceUnavailable: '此来源暂时没有可打开内容', sourceDetailHint: '点击查看来源详情', sourceDetailsTitle: '来源详情', sourcePreviewTitle: '内容摘录', sourceOpenBtn: '打开原页', sourceCopyBtn: '复制摘要', sourceLocateBtn: '定位来源', sourceLocated: '已定位到来源位置', sourceLocateFallback: '已打开来源页面，但未找到对应文本', sourceLocatedPreview: '已按摘录定位到来源位置', sourceLocatedTitle: '已按标题定位到来源位置', sourceLocatedLoose: '已通过宽松匹配定位到来源位置', sourceAskBtn: '问这个来源', sourceAskLabel: '来源追问', sourceAskReady: '已附加来源上下文', sourceQuestionHint: '补充你想问这个来源的问题...', sourcesAskBtn: '问这些来源', sourcesAskLabel: '多来源追问', sourcesQuestionHint: '补充你想问这些来源的问题...' },
  en: { newChat: 'New Chat', history: 'History', sidebarUI: 'Sidebar ▕', fullUI: 'Full UI ↗', quickChat: 'Quick Chat', send: 'Send a message...', screenshotHint: 'Describe what you want to ask...', contextHint: 'Add context (optional)...', noApiKey: 'API Key not set', noApiKeyHint: 'Configure in full UI', askLabel: 'Ask AI', rewriteShortLabel: 'Rewrite', translateLabel: 'Translate', summarizeLabel: 'Summarize Page', summarizeSelectionLabel: 'Summarize', rewriteLabel: 'Rewrite/Translate', webSearchLabel: 'Web Search', sidebarUnavailable: 'This browser does not support extension side panel', sidebarOpenFailed: 'Failed to open side panel', fullOpenFailed: 'Failed to open full window', applyToPage: 'Apply to Page', applySuccess: 'Applied to page', applyNoTarget: 'No editable target found on page', applySelectionOnly: 'The selected content is not editable', applyReadOnly: 'The current input is read-only', applyBuiltinPage: 'Cannot apply on browser built-in pages', applyFailed: 'Apply failed', autoApplySuccess: 'Selected text replaced automatically', askSelectFirst: 'Please select text on the page first', thinkingTitle: 'AI is thinking', thinkingHint: 'Request sent, waiting for the first reply', sourceOpened: 'Opened source page', sourceCopied: 'Copied source summary', sourceUnavailable: 'This source has no openable details', sourceDetailHint: 'Click to view source details', sourceDetailsTitle: 'Source Details', sourcePreviewTitle: 'Excerpt', sourceOpenBtn: 'Open Page', sourceCopyBtn: 'Copy Summary', sourceLocateBtn: 'Locate Source', sourceLocated: 'Located the source on page', sourceLocateFallback: 'Opened the source page, but could not find the exact text', sourceLocatedPreview: 'Located the source using the excerpt', sourceLocatedTitle: 'Located the source using the title', sourceLocatedLoose: 'Located the source using a loose match', sourceAskBtn: 'Ask This Source', sourceAskLabel: 'Source Follow-up', sourceAskReady: 'Source attached to composer', sourceQuestionHint: 'Ask a follow-up about this source...', sourcesAskBtn: 'Ask These Sources', sourcesAskLabel: 'Sources Follow-up', sourcesQuestionHint: 'Ask a follow-up about these sources...' },
};

function isGrokModel(model) {
  return /^grok([-.]|$)/i.test(String(model || '').trim());
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeGrokReasoningTranscript(text = '') {
  let normalized = String(text || '').replace(/\r\n/g, '\n');
  normalized = normalized.replace(/Thinking about your request(?=[A-Z])/g, 'Thinking about your request\n');

  Object.keys(REASONING_HEADING_PAGES).forEach((marker) => {
    if (marker === 'thinking about your request') return;
    const escaped = escapeRegExp(marker);
    normalized = normalized.replace(new RegExp(`([^\\n])(?=${escaped})`, 'gi'), '$1\n');
  });

  return normalized
    .replace(/([^\n])(?=-\s)/g, '$1\n')
    .replace(/([^\n])(?=##\s)/g, '$1\n')
    .replace(/([^\n])(?=###\s)/g, '$1\n')
    .replace(/([^\n])(?=\*\*[^*\n]{1,80}\*\*)/g, '$1\n');
}

function splitGrokReasoningAndAnswer(text = '') {
  const normalized = normalizeGrokReasoningTranscript(text);
  if (!/^\s*Thinking about your request/i.test(normalized)) {
    return { reasoning: '', answer: '' };
  }

  const lines = normalized.split('\n');
  const reasoningMarkers = Object.keys(REASONING_HEADING_PAGES);
  let answerIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (/^[-*•]\s+/.test(trimmed)) continue;

    const lower = trimmed.replace(/:$/, '').toLowerCase();
    if (
      lower.startsWith('thinking about your request') ||
      reasoningMarkers.some(marker => lower === marker || lower.startsWith(`${marker}:`))
    ) {
      continue;
    }

    answerIndex = i;
    break;
  }

  return {
    reasoning: answerIndex >= 0 ? lines.slice(0, answerIndex).join('\n').trim() : normalized.trim(),
    answer: answerIndex >= 0 ? lines.slice(answerIndex).join('\n').trim() : ''
  };
}

function extractReasoningSourceText(text, model = '') {
  const raw = String(text || '');
  if (!raw || !isGrokModel(model)) return '';

  const thinkMatch = raw.match(/^\s*<think\b[^>]*>([\s\S]*)$/i);
  if (thinkMatch) {
    return thinkMatch[1].replace(/<\/think>\s*[\s\S]*$/i, '').trim();
  }

  if (/^\s*Thinking about your request/i.test(raw)) {
    return splitGrokReasoningAndAnswer(raw).reasoning;
  }

  return '';
}

function clipReasoningPreviewLine(text = '', maxLength = 32) {
  const value = String(text || '').trim();
  if (!value) return '';
  if (value.length <= maxLength) return value;

  const slice = value.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.max(8, Math.floor(maxLength * 0.45))) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

function normalizeReasoningPreviewLine(line = '') {
  const cleaned = String(line || '')
    .replace(/<\/?think\b[^>]*>/gi, '')
    .replace(/\*\*/g, '')
    .replace(/^\s{0,3}(?:[-*•]\s+|#{1,6}\s+|>\s*)/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return clipReasoningPreviewLine(cleaned);
}

function extractReasoningDisplayPages(text, model = '') {
  const source = extractReasoningSourceText(text, model);
  if (!source) return [];

  const lines = normalizeGrokReasoningTranscript(source)
    .replace(/<\/?think\b[^>]*>/gi, '')
    .split('\n')
    .map(normalizeReasoningPreviewLine)
    .filter(Boolean);

  const pages = [];
  for (let i = 0; i < lines.length; i += 2) {
    pages.push([lines[i] || '', lines[i + 1] || '']);
  }

  return pages.slice(-6);
}

function extractStreamableAnswerText(text, model = '') {
  const raw = String(text || '');
  if (!raw) return '';
  if (!isGrokModel(model)) return raw.trimStart();

  const thinkOpenMatch = raw.match(/^\s*<think\b[^>]*>/i);
  if (thinkOpenMatch) {
    const thinkCloseMatch = raw.match(/<\/think\s*>/i);
    if (!thinkCloseMatch) return '';
    return raw.slice(thinkCloseMatch.index + thinkCloseMatch[0].length).trimStart();
  }

  if (/^\s*Thinking about your request/i.test(raw)) {
    return splitGrokReasoningAndAnswer(raw).answer.trimStart();
  }

  return raw.trimStart();
}

function sanitizeVisibleReasoningText(text, model = '', options = {}) {
  const raw = String(text || '');
  const hasThinkTag = /^\s*<think\b[^>]*>/i.test(raw);
  const hasThinkingPrefix = /^\s*Thinking about your request/i.test(raw);
  if (!raw || (!isGrokModel(model) && !hasThinkingPrefix && !hasThinkTag)) return raw;
  const hideIfOnlyReasoning = options.hideIfOnlyReasoning !== false;

  if (hasThinkTag) {
    const thinkCloseMatch = raw.match(/<\/think\s*>/i);
    const withoutThinkBlock = thinkCloseMatch
      ? raw.slice(thinkCloseMatch.index + thinkCloseMatch[0].length).trimStart()
      : '';
    if (withoutThinkBlock) {
      return withoutThinkBlock;
    }
    return hideIfOnlyReasoning ? '' : raw;
  }

  if (hasThinkingPrefix) {
    const answer = splitGrokReasoningAndAnswer(raw).answer.trimStart();
    if (answer) {
      return answer;
    }
    return hideIfOnlyReasoning ? '' : raw;
  }

  return raw;
}

function buildSourceReferenceBlock(source) {
  const info = EasyChatCore.describeContextSource(source);
  return [
    `来源：${info.text}`,
    source?.title ? `标题：${source.title}` : '',
    source?.url ? `链接：${source.url}` : '',
    source?.preview ? `摘录：${source.preview}` : ''
  ].filter(Boolean).join('\n');
}

function createSourceFollowupContext(source) {
  const L = LANG[config.language] || LANG.zh;
  const label = L.sourceAskLabel || '来源追问';
  const sourceBlock = buildSourceReferenceBlock(source);
  const isEnglish = config.language === 'en';
  return {
    type: 'source_followup',
    icon: '💬',
    label,
    source,
    meta: {
      contextSources: [source]
    },
    promptFn: (userText) => isEnglish
      ? `Answer the user's question primarily based on the source below. If the source is insufficient, explicitly mark that part as "Inference".${userText ? `\n\nUser Question: ${userText}` : '\n\nIf the user does not add a question, first summarize the source and then explain why it matters.'}\n\nSource:\n${sourceBlock}`
      : `请优先基于以下来源回答用户问题。如果来源不足以支持结论，请明确标注为“推测”。${userText ? `\n\n用户问题：${userText}` : '\n\n如果用户没有补充问题，请先概括该来源要点，再说明它的关键信息。'}\n\n来源信息：\n${sourceBlock}`
  };
}

function buildSourcesReferenceBlock(sources) {
  return EasyChatCore.dedupeContextSources(sources || [])
    .map((source, index) => `${index + 1}.\n${buildSourceReferenceBlock(source)}`)
    .join('\n\n');
}

function getSourcesFollowupLabel(count) {
  const L = LANG[config.language] || LANG.zh;
  return config.language === 'en'
    ? `${L.sourcesAskLabel || 'Sources Follow-up'} (${count})`
    : `${L.sourcesAskLabel || '多来源追问'}（${count}）`;
}

function getSourcesFollowupReadyMessage(count) {
  return config.language === 'en'
    ? `Attached ${count} sources to composer`
    : `已附加 ${count} 个来源`;
}

function createSourcesFollowupContext(sources) {
  const dedupedSources = EasyChatCore.dedupeContextSources(sources || []);
  const count = dedupedSources.length;
  const label = getSourcesFollowupLabel(count);
  const sourceBlock = buildSourcesReferenceBlock(dedupedSources);
  const isEnglish = config.language === 'en';
  return {
    type: 'sources_followup',
    icon: '🗂️',
    label,
    sources: dedupedSources,
    meta: {
      contextSources: dedupedSources
    },
    promptFn: (userText) => isEnglish
      ? `Answer the user's question primarily based on the sources below. Combine and compare them carefully. If the sources are insufficient, explicitly mark that part as "Inference".${userText ? `\n\nUser Question: ${userText}` : '\n\nIf the user does not add a question, first summarize the key points shared across these sources, then note any important differences.'}\n\nSources:\n${sourceBlock}`
      : `请优先基于以下多个来源回答用户问题，并注意综合与对比它们。如果来源不足以支持结论，请明确标注为“推测”。${userText ? `\n\n用户问题：${userText}` : '\n\n如果用户没有补充问题，请先概括这些来源的共同要点，再说明其中的重要差异。'}\n\n来源信息：\n${sourceBlock}`
  };
}

function getQuickComposerPlaceholder() {
  const L = LANG[config.language] || LANG.zh;
  if (pendingContext?.type === 'source_followup') return L.sourceQuestionHint || L.contextHint || '补充说明（可选）...';
  if (pendingContext?.type === 'sources_followup') return L.sourcesQuestionHint || L.contextHint || '补充说明（可选）...';
  if (pendingContext) return L.contextHint || '补充说明（可选）...';
  if (pendingScreenshot) return L.screenshotHint || '描述你想问的问题...';
  return L.send || '发送消息...';
}

function applyLanguage(lang) {
  const L = LANG[lang] || LANG.zh;
  document.getElementById('btnNewChat').title = L.newChat;
  document.getElementById('historyBtn').childNodes[0].textContent = L.history + ' ';
  document.getElementById('openSidebarBtn').textContent = L.sidebarUI;
  document.getElementById('openFullBtn').textContent = L.fullUI;
  document.querySelector('.section-title').textContent = L.quickChat;
  if (pendingContext?.type === 'source_followup' && pendingContext.source) {
    pendingContext = createSourceFollowupContext(pendingContext.source);
  } else if (pendingContext?.type === 'sources_followup' && pendingContext.sources?.length) {
    pendingContext = createSourcesFollowupContext(pendingContext.sources);
  }
  quickInput.placeholder = getQuickComposerPlaceholder();
  renderContextTag();
  updateStatus();
}

document.getElementById('langSelect').addEventListener('change', (e) => {
  config.language = e.target.value;
  chrome.storage.local.get('config', (d) => {
    const c = d.config || {};
    c.language = config.language;
    chrome.storage.local.set({ config: c });
  });
  applyLanguage(config.language);
});

// ── Session management ──
function newChat() {
  const id = Date.now().toString();
  sessions.unshift({ id, title: '新对话', messages: [], createdAt: Date.now() });
  currentId = id;
  save();
  renderSessionList();
  renderMessages([]);
}

function loadSession(id) {
  currentId = id;
  save();
  renderSessionList();
  const s = sessions.find(s => s.id === id);
  if (s) renderMessages(s.messages);
  restoreBackgroundStreamForCurrentSession().catch(() => {});
}

function renderSessionList() {
  const list = document.getElementById('sessionList');
  if (!list) return;
  list.innerHTML = '';
  sessions.slice(0, 30).forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item' + (s.id === currentId ? ' active' : '');
    item.textContent = s.title;
    item.title = s.title;
    item.addEventListener('click', () => {
      document.getElementById('sessionDrawer').classList.remove('open');
      loadSession(s.id);
    });
    list.appendChild(item);
  });
}

function renderMessages(msgs) {
  messagesArea.innerHTML = '';
  autoScroll = true;
  if (!msgs.length) {
    messagesArea.innerHTML = '<div class="empty-hint" id="emptyHint">选中文字后点工具按钮<br>或直接在这里输入</div>';
    return;
  }
  msgs.forEach(m => {
    const img = Array.isArray(m.content)
      ? m.content.find(p => p.type === 'image_url')?.image_url?.url : null;
    const role = m.role === 'assistant' ? 'ai' : 'user';
    if (m.role === 'assistant') {
      const bubble = addBubble('ai', '', img);
      renderAssistantMessage(bubble, m);
    } else {
      const bubble = addBubble('user', '', img);
      if (m.display) {
        renderUserDisplay(bubble, m.display);
        appendMessageParts(bubble, m.content);
      } else {
        const text = typeof m.content === 'string' ? m.content
          : m.content.find?.(p => p.type === 'text')?.text || '';
        bubble.textContent = text;
        appendMessageParts(bubble, m.content);
      }
    }
  });
  scrollBottom();
}

// ── Screenshot ──
function cropAndApply(fullDataUrl, rect) {
  const img = new Image();
  img.onload = () => {
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    c.width = rect.w * dpr; c.height = rect.h * dpr;
    c.getContext('2d').drawImage(img, rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr, 0, 0, c.width, c.height);
    applyPendingScreenshot(c.toDataURL('image/png'));
  };
  img.src = fullDataUrl;
}

function applyPendingScreenshot(dataUrl) {
  pendingScreenshot = dataUrl;
  pendingScreenshotMeta = EasyChatCore.createContextSource('screenshot', {
    label: '区域截图'
  });
  document.getElementById('screenshotPreviewImg').src = dataUrl;
  document.getElementById('screenshotPreviewWrap').style.display = 'block';
  quickInput.placeholder = LANG[config.language]?.screenshotHint || '描述你想问的问题...';
  quickInput.focus();
}

function updateStatus() {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  const L = LANG[config.language] || LANG.zh;
  if (config.apiKey) {
    dot.className = 'status-dot ok';
    txt.textContent = config.model || 'gpt-4o';
  } else {
    dot.className = 'status-dot';
    txt.textContent = L.noApiKey + ' — ' + L.noApiKeyHint;
  }
}

async function openSidebar() {
  const L = LANG[config.language] || LANG.zh;
  const res = await bgMessage({ type: 'OPEN_SIDE_PANEL', windowId: hostWindowId });
  if (res?.ok) return;
  if (res?.error === 'side_panel_unsupported') {
    toast(L.sidebarUnavailable);
    return;
  }
  console.error('[EasyChat] openSidebar failed:', res?.error || 'unknown_error');
  toast(L.sidebarOpenFailed);
}

// ── UI events ──
document.getElementById('openSidebarBtn').addEventListener('click', async () => {
  await storageSet({ currentSidebarSessionId: currentId });
  openSidebar();
});

document.getElementById('openFullBtn').addEventListener('click', async () => {
  const L = LANG[config.language] || LANG.zh;
  await storageSet({ currentId, [sessionStorageKey]: currentId });
  const res = await bgMessage({ type: 'OPEN_CHAT_WINDOW', sourceWindowId: hostWindowId, sessionId: currentId });
  if (!res?.ok) {
    console.error('[EasyChat] openFull failed:', res?.error || 'unknown_error');
    toast(L.fullOpenFailed);
  }
});

document.getElementById('btnNewChat').addEventListener('click', () => {
  newChat();
  quickInput.focus();
});


document.getElementById('historyBtn').addEventListener('click', () => {
  renderSessionList();
  document.getElementById('sessionDrawer').classList.toggle('open');
});

document.getElementById('drawerClose').addEventListener('click', () => {
  document.getElementById('sessionDrawer').classList.remove('open');
});

quickInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuick(); }
});
quickInput.addEventListener('input', () => {
  quickInput.style.height = 'auto';
  quickInput.style.height = Math.min(quickInput.scrollHeight, 80) + 'px';
});
sendBtn.addEventListener('click', () => sendQuick());
stopBtn.addEventListener('click', () => { abortController?.abort(); });

document.getElementById('removeScreenshot').addEventListener('click', () => {
  pendingScreenshot = null;
  pendingScreenshotMeta = null;
  document.getElementById('screenshotPreviewWrap').style.display = 'none';
  quickInput.placeholder = getQuickComposerPlaceholder();
});

// ── Send ──
async function sendQuick(prefillText, imageDataUrl) {
  const userText = prefillText !== undefined ? prefillText : quickInput.value.trim();
  const img = imageDataUrl || pendingScreenshot;
  const ctx = pendingContext;

  // Need at least some content
  if (!userText && !img && !ctx) return;
  if (streaming) return;
  if (!config.apiKey) { toast('请先在完整界面配置 API Key'); return; }

  if (!currentId) newChat();
  const s = currentSession();

  const apiText = ctx ? ctx.promptFn(userText) : userText;
  const displayText = EasyChatCore.buildDisplayText({
    context: ctx,
    userText,
    webSearchEnabled
  });

  const meta = EasyChatCore.buildMessageMeta({
    contextAction: ctx?.type,
    contextLabel: ctx?.label,
    sources: [...(ctx?.meta?.contextSources || [])],
    imageAttachments: img ? [{ kind: pendingScreenshotMeta ? 'screenshot' : 'image', label: pendingScreenshotMeta ? pendingScreenshotMeta.label : '图片' }] : [],
    webSearchEnabled
  });
  if (ctx?.meta?.autoApplyToPage) meta.autoApplyToPage = true;
  if (ctx?.meta?.sourceTabId) meta.sourceTabId = ctx.meta.sourceTabId;

  const userMsg = EasyChatCore.createUserMessage({
    text: apiText,
    imageUrls: img ? [img] : [],
    display: displayText,
    meta
  });

  s.messages.push(userMsg);
  if (s.messages.length === 1) s.title = (userText || ctx?.label || '').slice(0, 24);
  save();

  const sentBubble = addBubble('user', '', img);
  if (displayText) renderUserDisplay(sentBubble, displayText);
  // Re-append image if both displayText and img exist (renderUserDisplay clears innerHTML)
  if (displayText && img) {
    const imgEl = document.createElement('img');
    imgEl.src = img; imgEl.className = 'msg-img';
    sentBubble.appendChild(imgEl);
  }
  quickInput.value = '';
  quickInput.style.height = 'auto';
  pendingScreenshot = null;
  pendingScreenshotMeta = null;
  pendingContext = null;
  document.getElementById('screenshotPreviewWrap').style.display = 'none';
  renderContextTag();
  quickInput.placeholder = LANG[config.language]?.send || '发送消息...';
  hideEmpty();
  autoScroll = true;

  // Web search: perform real search and inject results (same as main chat)
  let searchResult = null;
  if (webSearchEnabled && userText) {
    showTyping();
    searchResult = await tavilySearch(userText);
    removeTyping();
    const searchSources = EasyChatCore.getSearchResultSources(searchResult);
    if (searchSources.length) {
      userMsg.meta = userMsg.meta || {};
      userMsg.meta.contextSources = EasyChatCore.dedupeContextSources([
        ...(userMsg.meta.contextSources || []).filter(source => source.kind !== 'web_search'),
        ...searchSources
      ]);
      save();
    }
  }

  // Try to proxy to open chat page, fallback to local doRequest
  const chatTabRes = await bgMessage({ type: 'FIND_CHAT_TAB' });
  if (chatTabRes?.tabId) {
    await doRequestViaChat(chatTabRes.tabId, s, searchResult);
  } else {
    await doBackgroundRequest(s, searchResult);
  }
}

// ── Tool buttons ──
document.getElementById('btnScreenshot').addEventListener('click', handleScreenshot);
document.getElementById('btnAskAI').addEventListener('click', () => handleContextAttach('ask'));
document.getElementById('btnRewrite').addEventListener('click', () => handleContextAttach('rewrite'));
document.getElementById('btnSummarize').addEventListener('click', () => handleContextAttach('summarize'));
document.getElementById('btnAnnotate').addEventListener('click', handleAnnotate);

document.getElementById('btnWebSearch').addEventListener('click', () => {
  webSearchEnabled = !webSearchEnabled;
  chrome.storage.local.set({ webSearchEnabled });
  document.getElementById('btnWebSearch').classList.toggle('active', webSearchEnabled);
});

// ── Context attachment (ask / summarize / rewrite) ──
async function handleContextAttach(type) {
  const tab = await getActiveTab();
  if (!tab) return;

  if (type === 'ask' || type === 'rewrite') {
    // Ensure content script is injected (needed for file:// pages with permission granted)
    await new Promise(resolve => {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, () => resolve());
    });
    const resp = await tabMessage(tab.id, { type: 'GET_SELECTION' });
    const text = resp?.text || '';
    if (!text) {
      const url = tab.url || '';
      if (url.startsWith('file://')) toast('本地文件需在扩展管理页开启"允许访问文件网址"');
      else toast(LANG[config.language]?.askSelectFirst || '请先在页面选中文字');
      return;
    }
    if (type === 'ask') {
      pendingContext = createSelectionActionContext('ask', {
        text,
        url: tab.url,
        title: tab.title
      });
    } else {
      pendingContext = {
        type: 'rewrite', icon: '✏️',
        label: LANG[config.language]?.rewriteLabel || '改写/翻译',
        meta: {
          contextSources: [EasyChatCore.createContextSource('selection', {
            label: LANG[config.language]?.rewriteLabel || '改写/翻译',
            preview: EasyChatCore.previewText(text),
            chars: text.length,
            url: tab.url,
            title: tab.title
          })]
        },
        promptFn: (userText) =>
          `请对以下文字进行改写或翻译（如果是中文则翻译成英文，如果是英文则翻译成中文，其他语言翻译成中文；同时提供一个改写版本）${userText ? '，用户备注：' + userText : ''}：\n\n${text}`
      };
    }
  } else {
    const btnEl = document.getElementById('btnSummarize');
    btnEl.classList.add('active');
    const pageText = await getPageText(tab);
    btnEl.classList.remove('active');
    if (!pageText) return;
    pendingContext = {
      type: 'summarize', icon: '📄',
      label: LANG[config.language]?.summarizeLabel || '总结网页',
      meta: {
        contextSources: [EasyChatCore.createContextSource('page', {
          label: LANG[config.language]?.summarizeLabel || '总结网页',
          preview: EasyChatCore.previewText(pageText),
          chars: pageText.length,
          url: tab.url,
          title: tab.title
        })]
      },
      promptFn: (userText) =>
        `请总结以下网页内容，提炼核心观点和关键信息，用简洁的中文输出${userText ? '，重点关注：' + userText : ''}：\n\n${pageText.slice(0, 6000)}`
    };
  }

  renderContextTag();
  quickInput.focus();
}

function renderContextTag() {
  const wrap = document.getElementById('contextTagsWrap');
  wrap.innerHTML = '';
  if (!pendingContext) {
    wrap.style.display = 'none';
    quickInput.placeholder = getQuickComposerPlaceholder();
    return;
  }
  wrap.style.display = 'flex';
  const tag = document.createElement('div');
  tag.className = 'context-tag';
  tag.innerHTML = `${pendingContext.icon} ${pendingContext.label}`;
  const rm = document.createElement('button');
  rm.className = 'context-tag-remove';
  rm.textContent = '×';
  rm.addEventListener('click', () => { pendingContext = null; renderContextTag(); });
  tag.appendChild(rm);
  wrap.appendChild(tag);
  quickInput.placeholder = getQuickComposerPlaceholder();
}

async function handleScreenshot() {
  const tab = await getActiveTab();
  if (!tab) return;

  // Must send message to content script BEFORE closing popup
  // So: capture first, inject content script message, then close
  const { dataUrl, error } = await bgMessage({ type: 'CAPTURE_SCREENSHOT' });
  if (error || !dataUrl) { toast('截图失败: ' + (error || '未知错误')); return; }

  await new Promise(resolve => chrome.storage.local.set({ _screenshotFull: dataUrl }, resolve));

  // Inject content script if not already there, then start region select
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, () => {
    // Now send the message — content script is guaranteed to be loaded
    chrome.tabs.sendMessage(tab.id, { type: 'START_REGION_SELECT' }, () => {
      if (!isSidePanelPage) window.close();
    });
  });
}

async function handleAnnotate() {
  const tab = await getActiveTab();
  if (!tab) return;
  if (!config.apiKey) { toast('请先配置 API Key'); return; }
  setToolLoading('btnAnnotate', true);
  const pageText = await getPageText(tab);
  if (!pageText) { setToolLoading('btnAnnotate', false); return; }

  if (!currentId) newChat();
  const s = currentSession();
  const prompt = `分析以下网页内容，找出 3-6 个值得标注的关键片段（重要概念、数据、结论等），以 JSON 数组返回，格式：
[{"text": "页面中的原文片段（15字以内）", "comment": "简短注释说明（30字以内）"}]
只返回 JSON，不要其他内容。\n\n网页内容：\n${pageText.slice(0, 5000)}`;

  hideEmpty();
  const annotateDisplay = `📌 自动标注`;
  const annotateUserBubble = addBubble('user', '');
  renderUserDisplay(annotateUserBubble, annotateDisplay);
  s.messages.push(EasyChatCore.createUserMessage({
    text: prompt,
    display: annotateDisplay,
    meta: EasyChatCore.buildMessageMeta({
      contextAction: 'annotate',
      contextLabel: '自动标注',
      sources: [EasyChatCore.createContextSource('page', {
        label: '自动标注',
        preview: EasyChatCore.previewText(pageText),
        chars: pageText.length,
        url: tab.url,
        title: tab.title
      })]
    })
  }));

  try {
    const result = await callOnce(prompt);
    setToolLoading('btnAnnotate', false);
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { addBubble('ai', '无法解析标注结果'); return; }
    const annotations = JSON.parse(jsonMatch[0]);
    await tabMessage(tab.id, { type: 'SET_ANNOTATIONS', annotations });
    const reply = `已在页面添加 ${annotations.length} 个标注气泡 📌`;
    const replyBubble = addBubble('ai', reply);
    appendSourceBadges(replyBubble, EasyChatCore.getMessageContextSources(s.messages[s.messages.length - 1]));
    s.messages.push(EasyChatCore.createAssistantMessage({
      content: result,
      display: reply,
      meta: {
        annotationCount: annotations.length,
        contextSources: EasyChatCore.getMessageContextSources(s.messages[s.messages.length - 1])
      }
    }));
    save();
  } catch (e) {
    setToolLoading('btnAnnotate', false);
    addBubble('ai', '标注失败: ' + e.message);
  }
}

// ── Proxy request to chat page ──
async function doRequestViaChat(tabId, s, searchResult) {
  streaming = true;
  proxyStreaming = true;
  sendBtn.style.display = 'none';
  stopBtn.style.display = 'flex';
  showTyping();
  let aiBubble = null;
  let full = '', lastRender = 0;

  // Listen for chunks relayed back from background
  const onMsg = (msg) => {
    if (msg.type === 'PROXY_CHUNK') {
      full = msg.full || full;
      if (!msg.full && msg.rawFull) {
        showReasoningPreview(msg.rawFull, msg.model || config.model);
        return;
      }
      const now = Date.now();
      if (now - lastRender > 80) {
        aiBubble = ensureAssistantBubble(aiBubble);
        renderBubble(aiBubble, full);
        lastRender = now;
        scrollBottom();
      }
    } else if (msg.type === 'PROXY_DONE') {
      aiBubble = ensureAssistantBubble(aiBubble);
      renderBubble(aiBubble, msg.full);
      scrollBottom();
      // Session already saved by chat page; reload from storage to stay in sync
      chrome.storage.local.get(['sessions'], async (data) => {
        if (data.sessions) {
          sessions = data.sessions;
          const updated = sessions.find(x => x.id === s.id);
          if (updated) Object.assign(s, updated);
        }
        const lastMsg = s.messages[s.messages.length - 1];
        await autoApplyAssistantMessageIfNeeded(s, lastMsg);
        if (s.id === currentId) renderMessages(s.messages);
        cleanup();
      });
    } else if (msg.type === 'PROXY_ERROR') {
      removeTyping();
      if (aiBubble) {
        aiBubble.className = 'msg-bubble';
        aiBubble.textContent = '错误: ' + msg.error;
      } else {
        addBubble('ai', '错误: ' + msg.error);
      }
      cleanup();
    }
  };

  const cleanup = () => {
    chrome.runtime.onMessage.removeListener(onMsg);
    removeTyping();
    streaming = false;
    proxyStreaming = false;
    sendBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
  };

  chrome.runtime.onMessage.addListener(onMsg);

  // Send request to chat page
  chrome.tabs.sendMessage(tabId, {
    type: 'PROXY_SEND',
    sessionId: s.id,
    messages: s.messages,
    searchResult,
    cfg: {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      topP: config.topP,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
      maxTokens: config.maxTokens,
      streamEnabled: true,
      contextLimit: config.contextLimit,
    }
  }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) {
      // Chat page didn't respond, fallback
      chrome.runtime.onMessage.removeListener(onMsg);
      streaming = false;
      proxyStreaming = false;
      sendBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
      removeTyping();
      doBackgroundRequest(s, searchResult);
    }
  });
}

function toApiContent(content) {
  return EasyChatCore.toApiContent(content);
}

// ── API call (streaming) ──
async function doBackgroundRequest(s, searchResult) {
  streaming = true;
  sendBtn.style.display = 'none';
  stopBtn.style.display = 'flex';
  showTyping();
  abortController = {
    type: 'background',
    sessionId: s.id,
    abort() {
      bgMessage({ type: 'STOP_BACKGROUND_STREAM', sessionId: s.id }).catch(() => {});
    }
  };

  const baseUrl = EasyChatCore.normalizeBaseUrl(config.baseUrl);
  const model = config.model || 'gpt-4o';
  const turnContext = EasyChatCore.resolveTurnContext(s.messages, { includeWebSearch: !!searchResult });
  const assistantMeta = EasyChatCore.buildAssistantMetaFromContext(turnContext);

  const msgs = s.messages.map(m => ({ role: m.role, content: toApiContent(m.content) }));

  EasyChatCore.appendSearchResultToLastUserMessage(msgs, searchResult, '联网搜索结果');

  const promptTail = [
    'Always format responses using Markdown.',
    EasyChatCore.buildSourceAwareInstruction(turnContext)
  ].filter(Boolean).join('\n\n');
  const sysPrompt = EasyChatCore.buildSystemMessage(config.systemPrompt, promptTail, promptTail);
  const apiMsgs = [{ role: 'system', content: sysPrompt }, ...msgs];

  const body = EasyChatCore.buildChatRequestBody({
    model,
    messages: apiMsgs,
    stream: true,
    temperature: config.temperature ?? 0.7,
    topP: config.topP ?? 1.0,
    frequencyPenalty: config.frequencyPenalty ?? 0.0,
    presencePenalty: config.presencePenalty ?? 0.0,
    maxTokens: config.maxTokens
  });

  try {
    const res = await bgMessage({
      type: 'START_BACKGROUND_STREAM',
      sessionId: s.id,
      baseUrl,
      apiKey: config.apiKey,
      body,
      model,
      assistantMeta
    });
    if (!res?.ok) throw new Error(res?.error || 'start_stream_failed');
    setBackgroundStreamControls(s.id);
    await restoreBackgroundStreamForCurrentSession();
  } catch (e) {
    removeTyping();
    setBackgroundStreamControls(null);
    if (e.name !== 'AbortError') {
      addBubble('ai', '错误: ' + e.message);
    }
  }
}

// ── One-shot call ──
async function callOnce(prompt) {
  const baseUrl = EasyChatCore.normalizeBaseUrl(config.baseUrl);
  const data = await EasyChatCore.requestChatCompletionJson({
    baseUrl,
    apiKey: config.apiKey,
    body: EasyChatCore.buildChatRequestBody({
      model: config.model || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      temperature: 0.3
    })
  });
  return data.choices?.[0]?.message?.content || '';
}

// ── DOM helpers ──
function hideEmpty() {
  const el = document.getElementById('emptyHint');
  if (el) el.remove();
}

function addBubble(role, text, imgUrl) {
  const row = document.createElement('div');
  row.className = 'msg ' + role;

  const av = document.createElement('div');
  av.className = 'msg-avatar ' + role;
  // Use same avatar as main chat if configured
  const avatarSrc = role === 'ai' ? config.aiAvatar : config.userAvatar;
  if (avatarSrc) {
    const img = document.createElement('img');
    img.src = avatarSrc;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    av.appendChild(img);
  } else {
    av.textContent = role === 'ai' ? '🤖' : '👤';
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (text) bubble.textContent = text;
  if (imgUrl) {
    const img = document.createElement('img');
    img.src = imgUrl; img.className = 'msg-img';
    bubble.appendChild(img);
  }
  row.appendChild(av); row.appendChild(bubble);
  messagesArea.appendChild(row);
  scrollBottom();
  return bubble;
}

function createSourceBadges(sources) {
  if (!sources?.length) return null;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;';
  const detailHost = document.createElement('div');
  let activeKey = '';
  let activeChip = null;
  sources.forEach(source => {
    const info = EasyChatCore.describeContextSource(source);
    const chip = document.createElement('button');
    const action = getSourceBadgeAction(source);
    chip.textContent = info.text;
    chip.type = 'button';
    chip.setAttribute('aria-label', info.label);
    chip.title = getSourceBadgeTitle(source, info, action);
    applySourceBadgeStyle(chip, false);
    if (action === 'inspect') {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = getSourceBadgeKey(source);
        if (activeKey === key) {
          activeKey = '';
          detailHost.replaceChildren();
          if (activeChip) applySourceBadgeStyle(activeChip, false);
          activeChip = null;
          return;
        }
        detailHost.replaceChildren(createSourceDetailCard(source));
        if (activeChip) applySourceBadgeStyle(activeChip, false);
        applySourceBadgeStyle(chip, true);
        activeChip = chip;
        activeKey = key;
      });
    }
    row.appendChild(chip);
  });
  wrap.appendChild(row);
  wrap.appendChild(detailHost);
  return wrap;
}

function appendSourceBadges(bubble, sources) {
  const badges = createSourceBadges(sources);
  if (badges) bubble.appendChild(badges);
}

function appendSourcesFollowupButton(bubble, message) {
  const L = LANG[config.language] || LANG.zh;
  const sources = EasyChatCore.getMessageContextSources(message);
  if ((sources?.length || 0) < 2) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:8px;';
  const btn = document.createElement('button');
  btn.textContent = `🗂️ ${L.sourcesAskBtn || '问这些来源'}`;
  btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;border:1px solid rgba(59,130,246,0.35);background:rgba(59,130,246,0.12);color:#bfdbfe;font-size:11px;cursor:pointer;';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pendingContext = createSourcesFollowupContext(sources);
    renderContextTag();
    quickInput.focus();
    toast(getSourcesFollowupReadyMessage(sources.length));
  });
  wrap.appendChild(btn);
  bubble.appendChild(wrap);
}

function renderAssistantMessage(bubble, message) {
  if (message.display) {
    bubble.textContent = message.display;
  } else {
    const rawText = typeof message.content === 'string' ? message.content
      : message.content.find?.(p => p.type === 'text')?.text || '';
    const text = sanitizeVisibleReasoningText(rawText, config.model).trim() || extractStreamableAnswerText(rawText, config.model).trim() || rawText;
    renderBubble(bubble, text);
  }
  appendSourceBadges(bubble, EasyChatCore.getMessageContextSources(message));
  appendSourcesFollowupButton(bubble, message);
  appendApplyButton(bubble, message);
}

function canApplyAssistantMessage(message) {
  return message?.role === 'assistant' && !message.display && !!EasyChatCore.extractPlainText(message.content).trim();
}

function getSourceBadgeKey(source) {
  return JSON.stringify([
    source?.kind || '',
    source?.label || '',
    source?.title || '',
    source?.url || '',
    source?.preview || ''
  ]);
}

function getSourceBadgeAction(source) {
  if (EasyChatCore.getContextSourceUrl(source) || EasyChatCore.hasContextSourceDetails(source)) return 'inspect';
  return 'none';
}

function getSourceBadgeTitle(source, info, action) {
  const L = LANG[config.language] || LANG.zh;
  const hint = action === 'inspect' ? L.sourceDetailHint : L.sourceUnavailable;
  return [info.title || info.label, hint].filter(Boolean).join('\n');
}

function applySourceBadgeStyle(chip, active) {
  chip.style.cssText = `display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:${active ? 'rgba(16,163,127,0.24)' : 'rgba(16,163,127,0.14)'};border:1px solid ${active ? 'rgba(16,163,127,0.48)' : 'rgba(16,163,127,0.3)'};color:${active ? '#d9fff5' : '#86efc7'};font-size:11px;line-height:1.45;cursor:${chip.disabled ? 'default' : 'pointer'};appearance:none;font:inherit;outline:none;`;
}

function createTab(options) {
  return new Promise(resolve => {
    chrome.tabs.create(options, (tab) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(tab || null);
    });
  });
}

function queryTabsByUrl(url) {
  return new Promise(resolve => {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) resolve([]);
      else resolve((tabs || []).filter(tab => tab.url === url));
    });
  });
}

function activateTab(tabId) {
  return new Promise(resolve => {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(tab || null);
    });
  });
}

function focusWindow(windowId) {
  return new Promise(resolve => {
    if (!windowId) {
      resolve(false);
      return;
    }
    chrome.windows.update(windowId, { focused: true }, () => resolve(!chrome.runtime.lastError));
  });
}

async function openSourceTab(url) {
  const existingTabs = await queryTabsByUrl(url);
  const existing = existingTabs.find(tab => hostWindowId && tab.windowId === hostWindowId) || existingTabs[0] || null;
  if (existing?.id) {
    const updated = await activateTab(existing.id);
    await focusWindow((updated || existing).windowId);
    return updated || existing;
  }

  const primary = await createTab(hostWindowId ? { url, active: true, windowId: hostWindowId } : { url, active: true });
  if (primary) return primary;
  return createTab({ url, active: true });
}

function waitForTabReady(tabId, timeoutMs = 12000) {
  return new Promise(resolve => {
    if (!tabId) {
      resolve(false);
      return;
    }

    let settled = false;
    let timer = 0;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(ok);
    };
    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') finish(true);
    };

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        finish(false);
        return;
      }
      if (tab?.status === 'complete') {
        finish(true);
        return;
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
      timer = window.setTimeout(() => finish(false), timeoutMs);
    });
  });
}

async function openSourceUrl(url) {
  const tab = await openSourceTab(url);
  return !!tab?.id;
}

async function locateSourceInPage(source) {
  const L = LANG[config.language] || LANG.zh;
  const url = EasyChatCore.getContextSourceUrl(source);
  if (!url) {
    toast(L.sourceUnavailable);
    return false;
  }

  const tab = await openSourceTab(url);
  if (!tab?.id) {
    toast(L.sourceUnavailable);
    return false;
  }

  const ready = await waitForTabReady(tab.id);
  if (!ready) {
    toast(L.sourceOpened);
    return false;
  }

  const injected = await ensureContentScriptInjected(tab.id);
  if (!injected) {
    toast(L.sourceOpened);
    return false;
  }

  const resp = await tabMessage(tab.id, { type: 'HIGHLIGHT_CONTEXT_SOURCE', source });
  if (resp?.ok) {
    toast(getSourceLocateMessage(resp, L));
    return true;
  }

  toast(resp?.error === 'text_not_found' ? L.sourceLocateFallback : L.sourceOpened);
  return false;
}

function getSourceLocateMessage(resp, L) {
  if (resp?.loose) return L.sourceLocatedLoose || L.sourceLocated;
  if (resp?.matchedKind === 'title') return L.sourceLocatedTitle || L.sourceLocated;
  if (resp?.matchedKind === 'preview') return L.sourceLocatedPreview || L.sourceLocated;
  return L.sourceLocated;
}

async function copySourceSummary(source) {
  const L = LANG[config.language] || LANG.zh;
  const summary = EasyChatCore.hasContextSourceDetails(source)
    ? EasyChatCore.buildContextSourceSummary(source)
    : '';
  if (!summary) {
    toast(L.sourceUnavailable);
    return false;
  }

  try {
    await navigator.clipboard.writeText(summary);
    toast(L.sourceCopied);
    return true;
  } catch {
    toast(L.sourceUnavailable);
    return false;
  }
}

function createSourceDetailActionButton(label, accent) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;border:1px solid ${accent ? 'rgba(16,163,127,0.42)' : 'rgba(255,255,255,0.12)'};background:${accent ? 'rgba(16,163,127,0.16)' : 'rgba(255,255,255,0.04)'};color:${accent ? '#d9fff5' : '#b8c6c1'};font-size:11px;cursor:pointer;appearance:none;font:inherit;`;
  return btn;
}

function createSourceDetailCard(source) {
  const L = LANG[config.language] || LANG.zh;
  const info = EasyChatCore.describeContextSource(source);
  const url = EasyChatCore.getContextSourceUrl(source);
  const summary = EasyChatCore.buildContextSourceSummary(source);
  const card = document.createElement('div');
  card.style.cssText = 'padding:10px 11px;border-radius:12px;border:1px solid rgba(16,163,127,0.22);background:rgba(15,23,42,0.46);display:flex;flex-direction:column;gap:8px;';

  const kicker = document.createElement('div');
  kicker.textContent = L.sourceDetailsTitle;
  kicker.style.cssText = 'font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3b7;';
  card.appendChild(kicker);

  const label = document.createElement('div');
  label.textContent = info.text;
  label.style.cssText = 'font-size:12px;font-weight:600;color:#eafff6;';
  card.appendChild(label);

  if (source?.title) {
    const title = document.createElement('div');
    title.textContent = source.title;
    title.style.cssText = 'font-size:12px;line-height:1.5;color:#d5e5df;';
    card.appendChild(title);
  }

  if (url) {
    const urlEl = document.createElement('div');
    urlEl.textContent = url;
    urlEl.style.cssText = 'font-size:11px;line-height:1.5;color:#7dd3b7;word-break:break-all;';
    card.appendChild(urlEl);
  }

  if (source?.preview) {
    const previewTitle = document.createElement('div');
    previewTitle.textContent = L.sourcePreviewTitle;
    previewTitle.style.cssText = 'font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#8ca29b;';
    card.appendChild(previewTitle);

    const preview = document.createElement('div');
    preview.textContent = source.preview;
    preview.style.cssText = 'font-size:12px;line-height:1.55;color:#c9d6d1;white-space:pre-wrap;';
    card.appendChild(preview);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
  const askBtn = createSourceDetailActionButton(L.sourceAskBtn, !url && !summary);
  askBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pendingContext = createSourceFollowupContext(source);
    renderContextTag();
    quickInput.focus();
    toast(L.sourceAskReady);
  });
  actions.appendChild(askBtn);
  if (url) {
    if (source?.preview || source?.title) {
      const locateBtn = createSourceDetailActionButton(L.sourceLocateBtn, true);
      locateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await locateSourceInPage(source);
      });
      actions.appendChild(locateBtn);
    }

    const openBtn = createSourceDetailActionButton(L.sourceOpenBtn, !(source?.preview || source?.title));
    openBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const opened = await openSourceUrl(url);
      toast(opened ? L.sourceOpened : L.sourceUnavailable);
    });
    actions.appendChild(openBtn);
  }
  if (summary) {
    const copyBtn = createSourceDetailActionButton(L.sourceCopyBtn, false);
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await copySourceSummary(source);
    });
    actions.appendChild(copyBtn);
  }
  if (actions.childNodes.length) card.appendChild(actions);

  return card;
}

function getApplyErrorMessage(error) {
  const L = LANG[config.language] || LANG.zh;
  if (error === 'selection_not_editable') return L.applySelectionOnly;
  if (error === 'no_editable_target' || error === 'host_tab_not_found') return L.applyNoTarget;
  if (error === 'input_read_only') return L.applyReadOnly;
  return L.applyFailed;
}

function getTabById(tabId) {
  return new Promise(resolve => {
    if (!tabId) {
      resolve(null);
      return;
    }
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(tab || null);
    });
  });
}

function ensureContentScriptInjected(tabId) {
  return new Promise(resolve => {
    chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

async function applyAssistantTextToTab(tab, text) {
  const tabId = tab?.tabId || tab?.id;
  if (!tabId) return { ok: false, error: 'host_tab_not_found' };

  if (/^(edge|chrome|about):/i.test(tab?.url || '')) {
    return { ok: false, error: 'builtin_page' };
  }

  const injected = await ensureContentScriptInjected(tabId);
  if (!injected) return { ok: false, error: 'script_injection_failed' };

  const resp = await tabMessage(tabId, { type: 'APPLY_ASSISTANT_TEXT', text });
  return resp?.ok ? { ok: true } : { ok: false, error: resp?.error || 'apply_failed' };
}

async function getApplyTargetTab() {
  const res = await bgMessage({ type: 'GET_HOST_ACTIVE_TAB', windowId: hostWindowId });
  return res?.ok ? res : null;
}

async function applyAssistantMessageToPage(message) {
  const L = LANG[config.language] || LANG.zh;
  const text = EasyChatCore.extractPlainText(message?.content).trim();
  if (!text) {
    toast(L.applyFailed);
    return;
  }

  const tab = await getApplyTargetTab();
  if (!tab?.tabId) {
    toast(L.applyNoTarget);
    return;
  }

  const result = await applyAssistantTextToTab(tab, text);
  if (result.ok) toast(L.applySuccess);
  else if (result.error === 'builtin_page') toast(L.applyBuiltinPage);
  else toast(getApplyErrorMessage(result.error));
}

async function autoApplyAssistantMessageIfNeeded(session, message) {
  const L = LANG[config.language] || LANG.zh;
  if (!message?.meta?.autoApplyToPage || !message.meta.sourceTabId || message.meta.autoAppliedAt) return false;
  const text = EasyChatCore.extractPlainText(message.content).trim();
  if (!text) return false;

  const tab = await getTabById(message.meta.sourceTabId);
  const result = await applyAssistantTextToTab(tab, text);
  if (!result.ok) {
    if (result.error === 'builtin_page') toast(L.applyBuiltinPage);
    else toast(getApplyErrorMessage(result.error));
    return false;
  }

  message.meta.autoAppliedAt = Date.now();
  if (session) save();
  toast(L.autoApplySuccess);
  return true;
}

function appendApplyButton(bubble, message) {
  if (!canApplyAssistantMessage(message)) return;
  const L = LANG[config.language] || LANG.zh;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:8px;';
  const btn = document.createElement('button');
  btn.textContent = `↩ ${L.applyToPage}`;
  btn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;border:1px solid rgba(16,163,127,0.35);background:rgba(16,163,127,0.12);color:#86efc7;font-size:11px;cursor:pointer;';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyAssistantMessageToPage(message);
  });
  wrap.appendChild(btn);
  bubble.appendChild(wrap);
}

// Render a user bubble that has a display string (may contain icon+label prefix)
// Format: "🌐 联网搜索  user text" or "💬 问 AI" (no extra text)
// Icons that indicate a context tag: emoji followed by space and label
function renderUserDisplay(bubble, display) {
  bubble.innerHTML = '';
  const parsed = EasyChatCore.parseDisplayText(display);
  if (parsed?.tagged) {
    const tag = document.createElement('span');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:rgba(16,163,127,0.15);border:1px solid rgba(16,163,127,0.4);border-radius:10px;padding:1px 7px;font-size:11px;color:#10a37f;margin-right:5px;white-space:nowrap;';
    tag.textContent = parsed.label;
    bubble.appendChild(tag);

    if (parsed.text) {
      bubble.appendChild(document.createTextNode(parsed.text));
    }
  } else {
    bubble.textContent = display;
  }
}

function renderBubble(bubble, text) {
  if (typeof marked !== 'undefined') {
    bubble.className = 'msg-bubble md';
    bubble.innerHTML = marked.parse(text);
    bubble.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
  } else {
    bubble.textContent = text;
  }
}

function renderThinkingBubble(bubble) {
  const L = LANG[config.language] || LANG.zh;
  bubble.className = 'msg-bubble thinking-bubble';
  bubble.innerHTML = EasyChatCore.buildThinkingIndicatorHtml(L.thinkingTitle, L.thinkingHint);
}

function createAiAvatarElement(extraClass = '') {
  const av = document.createElement('div');
  av.className = `msg-avatar ai${extraClass ? ` ${extraClass}` : ''}`;
  if (config.aiAvatar) {
    const img = document.createElement('img');
    img.src = config.aiAvatar;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    av.appendChild(img);
  } else {
    av.textContent = '🤖';
  }
  return av;
}

function setTypingPageContent(pageEl, pageLines) {
  if (!pageEl) return;
  const lines = pageEl.querySelectorAll('.typing-line');
  const [line1 = '', line2 = ''] = pageLines || [];
  if (lines[0]) lines[0].textContent = line1;
  if (lines[1]) lines[1].textContent = line2;
}

function stopTypingAnimation(state = typingFlipState) {
  if (state?.timer) clearInterval(state.timer);
  if (!state) return;
  state.timer = 0;
  state.flipping = false;
  state.deck = null;
  state.currentPage = null;
  state.nextPage = null;
  state.pages = [];
  state.index = 0;
}

function clearTypingFlipState() {
  stopTypingAnimation(typingFlipState);
  typingFlipState = null;
}

function ensureTypingState() {
  let row = document.getElementById('typing');
  if (!row) {
    row = document.createElement('div');
    row.className = 'msg ai typing-row';
    row.id = 'typing';
    row.appendChild(createAiAvatarElement('typing-avatar'));
    const stage = document.createElement('div');
    stage.className = 'typing-stage';
    row.appendChild(stage);
    messagesArea.appendChild(row);
  }

  const stage = row.querySelector('.typing-stage');
  if (!typingFlipState || typingFlipState.row !== row) {
    stopTypingAnimation(typingFlipState);
    typingFlipState = {
      row,
      stage,
      mode: 'waiting',
      deck: null,
      currentPage: null,
      nextPage: null,
      pages: [],
      index: 0,
      flipping: false,
      timer: 0
    };
  } else {
    typingFlipState.stage = stage;
  }

  return typingFlipState;
}

function queueTypingFlip() {
  const state = typingFlipState;
  if (!state || state.mode !== 'reasoning' || state.flipping || state.pages.length < 2 || !state.deck) return;
  const nextIndex = (state.index + 1) % state.pages.length;
  setTypingPageContent(state.nextPage, state.pages[nextIndex]);
  state.flipping = true;
  state.deck.classList.add('flipping');
  window.setTimeout(() => {
    if (!typingFlipState || typingFlipState !== state) return;
    setTypingPageContent(state.currentPage, state.pages[nextIndex]);
    state.index = nextIndex;
    state.flipping = false;
    state.deck.classList.remove('flipping');
  }, 460);
}

function renderWaitingRibbon(state) {
  if (!state) return;
  stopTypingAnimation(state);
  state.mode = 'waiting';
  state.stage.innerHTML = `
    <div class="typing-ribbon" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
}

function renderReasoningPreview(state, pages) {
  if (!state) return;
  stopTypingAnimation(state);
  const activePages = Array.isArray(pages) ? pages.filter(page => Array.isArray(page) && page.some(Boolean)) : [];
  if (!activePages.length) return;
  state.mode = 'reasoning';
  state.pages = activePages;
  state.index = 0;
  state.stage.innerHTML = `
    <div class="typing-reasoning" aria-hidden="true">
      <div class="typing-deck">
        <div class="typing-sheet typing-sheet-current">
          <div class="typing-line"></div>
          <div class="typing-line typing-line-muted"></div>
        </div>
        <div class="typing-sheet typing-sheet-next">
          <div class="typing-line"></div>
          <div class="typing-line typing-line-muted"></div>
        </div>
      </div>
    </div>
  `;

  state.deck = state.stage.querySelector('.typing-deck');
  state.currentPage = state.stage.querySelector('.typing-sheet-current');
  state.nextPage = state.stage.querySelector('.typing-sheet-next');
  setTypingPageContent(state.currentPage, activePages[0]);
  setTypingPageContent(state.nextPage, activePages[1] || activePages[0]);

  if (activePages.length > 1) {
    state.timer = window.setInterval(queueTypingFlip, 1500);
  }
}

function showTyping() {
  const state = ensureTypingState();
  renderWaitingRibbon(state);
  scrollBottom();
  return state.row;
}

function showReasoningPreview(text, model) {
  const pages = extractReasoningDisplayPages(text, model);
  if (!pages.length) {
    showTyping();
    return;
  }

  const state = ensureTypingState();
  if (state.mode !== 'reasoning') {
    renderReasoningPreview(state, pages);
    scrollBottom();
    return;
  }

  state.pages = pages;
  if (state.index >= pages.length) state.index = 0;

  if (!state.flipping) {
    setTypingPageContent(state.currentPage, state.pages[state.index]);
    setTypingPageContent(state.nextPage, state.pages[(state.index + 1) % state.pages.length] || state.pages[state.index]);
  }

  if (pages.length < 2 && state.timer) {
    clearInterval(state.timer);
    state.timer = 0;
  } else if (pages.length > 1 && !state.timer) {
    state.timer = window.setInterval(queueTypingFlip, 1500);
  }

  scrollBottom();
}

function removeTyping() {
  clearTypingFlipState();
  const el = document.getElementById('typing');
  if (el) el.remove();
}

function ensureAssistantBubble(existingBubble) {
  if (existingBubble) return existingBubble;
  removeTyping();
  return addBubble('ai', '');
}

function addTyping() {
  return showTyping();
}

function scrollBottom() {
  if (autoScroll) messagesArea.scrollTop = messagesArea.scrollHeight;
}

function setToolLoading(id, loading) {
  document.getElementById(id).classList.toggle('loading', loading);
}

function toast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function bgMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

// Returns page text, or shows an appropriate error toast and returns ''
async function getPageText(tab) {
  // Try injecting content script first (handles cases where it wasn't auto-injected)
  await new Promise(resolve => {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, () => resolve());
  });
  const resp = await tabMessage(tab.id, { type: 'GET_PAGE_TEXT' });
  const text = resp?.text || '';
  if (!text) {
    const url = tab.url || '';
    if (url.startsWith('file://')) {
      toast('本地文件需在扩展管理页开启"允许访问文件网址"');
    } else if (url.startsWith('edge://') || url.startsWith('chrome://') || url.startsWith('about:')) {
      toast('浏览器内置页面无法获取内容');
    } else {
      toast('无法获取页面内容');
    }
  }
  return text;
}

function tabMessage(tabId, msg) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

async function getActiveTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
  });
}

// ── Web search (mirrors main chat implementation) ──
async function tavilySearch(query) {
  return EasyChatCore.executeSearch(query, config, {
    referenceSourceLabel: '参考来源：',
    searchResultsLabel: '搜索结果：',
    noTitleLabel: '无标题',
    webSearchResult: '搜索结果',
    onMissingKey: () => toast('请先在完整界面配置搜索 API Key')
  });
}
