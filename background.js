// background.js - service worker

// Open or focus the popup window when the extension icon is clicked
let popupWindowId = null;
let chatWindowId = null;
let lastNormalWindowId = null;
let chatHostWindowId = null;
const activeStreams = new Map();
chrome.action.onClicked.addListener(() => {
  if (popupWindowId !== null) {
    chrome.windows.get(popupWindowId, (win) => {
      if (chrome.runtime.lastError || !win) {
        popupWindowId = null;
        openPopupWindow();
      } else {
        chrome.windows.update(popupWindowId, { focused: true });
      }
    });
  } else {
    openPopupWindow();
  }
});

function openPopupWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 420,
    height: 600,
  }, (win) => {
    popupWindowId = win.id;
  });
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) popupWindowId = null;
  if (windowId === chatWindowId) chatWindowId = null;
  if (windowId === lastNormalWindowId) lastNormalWindowId = null;
  if (windowId === chatHostWindowId) chatHostWindowId = null;
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.windows.get(windowId, {}, (win) => {
    if (chrome.runtime.lastError || !win) return;
    if (win.type === 'normal') lastNormalWindowId = win.id;
  });
});

async function openOrFocusChatWindow(sourceWindowId, sessionId) {
  if (sourceWindowId) {
    lastNormalWindowId = sourceWindowId;
    chatHostWindowId = sourceWindowId;
  }

  if (chatWindowId !== null) {
    try {
      await chrome.windows.get(chatWindowId);
      await chrome.windows.update(chatWindowId, { focused: true });
      if (chatHostWindowId) {
        chrome.runtime.sendMessage({ type: 'SET_CHAT_HOST_WINDOW', windowId: chatHostWindowId }).catch(() => {});
      }
      if (sessionId) {
        chrome.runtime.sendMessage({ type: 'OPEN_CHAT_SESSION', sessionId }).catch(() => {});
      }
      return { ok: true, reused: true, windowId: chatWindowId };
    } catch {
      chatWindowId = null;
    }
  }

  const params = new URLSearchParams();
  if (chatHostWindowId) params.set('sourceWindowId', String(chatHostWindowId));
  if (sessionId) params.set('sessionId', String(sessionId));
  const url = chrome.runtime.getURL(`chat.html${params.toString() ? `?${params.toString()}` : ''}`);
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: 1200,
    height: 800,
  });
  chatWindowId = win?.id ?? null;
  return { ok: true, reused: false, windowId: chatWindowId };
}

async function getActiveHostTab(preferredWindowId) {
  const candidateWindowIds = [];
  [preferredWindowId, chatHostWindowId, lastNormalWindowId].forEach(id => {
    if (id && !candidateWindowIds.includes(id)) candidateWindowIds.push(id);
  });

  for (const windowId of candidateWindowIds) {
    try {
      const win = await chrome.windows.get(windowId);
      if (!win || win.type !== 'normal') continue;
      const tabs = await chrome.tabs.query({ active: true, windowId });
      const tab = tabs.find(t => t?.id && t.url && !t.url.startsWith('chrome-extension://'));
      if (tab) return tab;
    } catch {}
  }

  const fallbackTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return fallbackTabs.find(t => t?.id && t.url && !t.url.startsWith('chrome-extension://')) || null;
}

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function normalizeBaseUrl(baseUrl) {
  let normalized = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  if (!normalized.endsWith('/v1')) normalized += '/v1';
  return normalized;
}

function parseErrorMessage(raw, status) {
  let message = `HTTP ${status}`;
  try {
    message = JSON.parse(raw).error?.message || message;
  } catch {}
  return message;
}

function isGrokModel(model) {
  return /^grok([-.]|$)/i.test(String(model || '').trim());
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    if (withoutThinkBlock) return withoutThinkBlock;
    return hideIfOnlyReasoning ? '' : raw;
  }

  if (hasThinkingPrefix) {
    const answer = splitGrokReasoningAndAnswer(raw).answer.trimStart();
    if (answer) return answer;
    return hideIfOnlyReasoning ? '' : raw;
  }

  return raw;
}

function broadcastStreamEvent(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function persistAssistantMessage(sessionId, content, meta) {
  const data = await storageGet(['sessions']);
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const session = sessions.find(item => item.id === sessionId);
  if (!session) return;
  if (!Array.isArray(session.messages)) session.messages = [];
  session.messages.push({
    role: 'assistant',
    content,
    time: Date.now(),
    ...(meta && Object.keys(meta).length ? { meta } : {})
  });
  await chrome.storage.local.set({ sessions });
}

function getActiveStreamSnapshot(sessionId) {
  const state = activeStreams.get(sessionId);
  if (!state) return null;
  return {
    sessionId: state.sessionId,
    model: state.model,
    rawFull: state.rawFull,
    startedAt: state.startedAt
  };
}

async function startBackgroundStream(options) {
  const opts = options || {};
  const sessionId = String(opts.sessionId || '').trim();
  if (!sessionId) throw new Error('missing_session_id');
  if (!opts.baseUrl || !opts.apiKey || !opts.body) throw new Error('missing_request_config');

  const existing = activeStreams.get(sessionId);
  if (existing?.controller) existing.controller.abort();

  const controller = new AbortController();
  const state = {
    sessionId,
    model: opts.model || opts.body?.model || 'gpt-4o',
    rawFull: '',
    controller,
    startedAt: Date.now()
  };
  activeStreams.set(sessionId, state);

  (async () => {
    try {
      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${opts.apiKey}`
        },
        body: JSON.stringify(opts.body),
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error(parseErrorMessage(await res.text(), res.status));
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (!delta) continue;
            state.rawFull += delta;
            broadcastStreamEvent({
              type: 'STREAM_CHUNK',
              sessionId,
              model: state.model,
              rawFull: state.rawFull
            });
          } catch {}
        }
      }

      const finalText = sanitizeVisibleReasoningText(state.rawFull, state.model).trim() || extractStreamableAnswerText(state.rawFull, state.model).trim();
      if (!finalText) throw new Error('模型未返回可显示正文');
      await persistAssistantMessage(sessionId, finalText, opts.assistantMeta || null);
      broadcastStreamEvent({
        type: 'STREAM_DONE',
        sessionId,
        model: state.model,
        rawFull: state.rawFull,
        full: finalText
      });
    } catch (err) {
      if (controller.signal.aborted) {
        broadcastStreamEvent({
          type: 'STREAM_ERROR',
          sessionId,
          model: state.model,
          stopped: true,
          error: 'stopped'
        });
      } else {
        broadcastStreamEvent({
          type: 'STREAM_ERROR',
          sessionId,
          model: state.model,
          error: err?.message || 'request_failed'
        });
      }
    } finally {
      activeStreams.delete(sessionId);
    }
  })();

  return { ok: true, sessionId };
}

function containsCjk(text) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(text || ''));
}

function guessTranslateTarget(text) {
  return containsCjk(text) ? '英文' : '中文';
}

async function getEffectiveConfig() {
  const data = await storageGet(['config', 'profiles', 'currentProfile']);
  const profiles = data.profiles || {};
  const currentProfile = data.currentProfile || 'default';
  const profile = profiles[currentProfile] || {};
  const savedConfig = data.config || {};
  return {
    baseUrl: profile.baseUrl || savedConfig.baseUrl || '',
    apiKey: profile.apiKey || savedConfig.apiKey || '',
    model: profile.model || savedConfig.model || 'gpt-4o',
    temperature: profile.temperature ?? savedConfig.temperature ?? 0.2,
    topP: profile.topP ?? savedConfig.topP ?? 1.0,
    frequencyPenalty: profile.frequencyPenalty ?? savedConfig.frequencyPenalty ?? 0.0,
    presencePenalty: profile.presencePenalty ?? savedConfig.presencePenalty ?? 0.0,
    maxTokens: profile.maxTokens || savedConfig.maxTokens || ''
  };
}

function extractMessageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(part => part?.type === 'text')
    .map(part => part.text || '')
    .join('');
}

async function translateSelectionInline(text) {
  const input = String(text || '').trim();
  if (!input) {
    return { ok: false, error: 'empty_selection', message: '未选择内容' };
  }

  const config = await getEffectiveConfig();
  if (!config.apiKey) {
    return { ok: false, error: 'missing_api_key', message: '请先在完整界面配置 API Key' };
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const target = guessTranslateTarget(input);
  const body = {
    model: config.model || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a precise translation assistant. Return only the translation with no explanations, quotes, or extra commentary.'
      },
      {
        role: 'user',
        content: `请将以下文字翻译成${target}，只输出译文，不要添加引号、解释、标题或额外说明：\n\n${input}`
      }
    ],
    stream: false,
    temperature: Math.min(config.temperature ?? 0.2, 0.4),
    top_p: config.topP ?? 1.0,
    frequency_penalty: config.frequencyPenalty ?? 0.0,
    presence_penalty: config.presencePenalty ?? 0.0
  };

  const maxTokens = parseInt(config.maxTokens, 10);
  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    body.max_tokens = Math.min(maxTokens, 400);
  } else {
    body.max_tokens = 400;
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: 'api_error',
        message: data?.error?.message || `HTTP ${res.status}`
      };
    }

    const translation = extractMessageText(data?.choices?.[0]?.message?.content).trim();
    if (!translation) {
      return { ok: false, error: 'empty_translation', message: '模型没有返回译文' };
    }

    return {
      ok: true,
      translation,
      targetLanguage: target
    };
  } catch (err) {
    return {
      ok: false,
      error: 'request_failed',
      message: err?.message || '翻译请求失败'
    };
  }
}

// Relay PROXY_* and CHAT_* messages from chat page back to popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PROXY_CHUNK' || msg.type === 'PROXY_DONE' || msg.type === 'PROXY_ERROR' ||
      msg.type === 'CHAT_CHUNK' || msg.type === 'CHAT_DONE') {
    // Only relay if the sender is an extension page (has a url), not background itself
    if (sender && sender.url) {
      chrome.runtime.sendMessage(msg).catch(() => {});
    }
    return false;
  }
});

// Handle screenshot capture request from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_CHAT_WINDOW') {
    openOrFocusChatWindow(msg.sourceWindowId, msg.sessionId).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err?.message || 'open_chat_failed' });
    });
    return true;
  }

  if (msg.type === 'GET_HOST_ACTIVE_TAB') {
    getActiveHostTab(msg.windowId).then((tab) => {
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'host_tab_not_found' });
        return;
      }
      sendResponse({
        ok: true,
        tabId: tab.id,
        windowId: tab.windowId,
        url: tab.url || '',
        title: tab.title || ''
      });
    }).catch(err => {
      sendResponse({ ok: false, error: err?.message || 'host_tab_lookup_failed' });
    });
    return true;
  }

  if (msg.type === 'TRANSLATE_SELECTION_INLINE') {
    translateSelectionInline(msg.text || '').then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: 'request_failed', message: err?.message || '翻译请求失败' });
    });
    return true;
  }

  if (msg.type === 'START_BACKGROUND_STREAM') {
    startBackgroundStream(msg).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err?.message || 'start_stream_failed' });
    });
    return true;
  }

  if (msg.type === 'GET_ACTIVE_STREAM') {
    sendResponse({ ok: true, stream: getActiveStreamSnapshot(msg.sessionId) });
    return false;
  }

  if (msg.type === 'STOP_BACKGROUND_STREAM') {
    const state = activeStreams.get(String(msg.sessionId || ''));
    if (!state?.controller) {
      sendResponse({ ok: false, error: 'stream_not_found' });
      return false;
    }
    state.controller.abort();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'OPEN_SELECTION_ACTION' || msg.type === 'OPEN_SELECTION_ASK') {
    const text = (msg.payload?.text || '').trim();
    const action = msg.payload?.action || 'ask';
    const targetWindowId = sender.tab?.windowId || msg.windowId || chatHostWindowId || lastNormalWindowId;
    if (!text) {
      sendResponse({ ok: false, error: 'empty_selection' });
      return false;
    }
    if (!targetWindowId) {
      sendResponse({ ok: false, error: 'window_not_found' });
      return false;
    }
    if (!chrome.sidePanel?.open) {
      sendResponse({ ok: false, error: 'side_panel_unsupported' });
      return false;
    }

    const pendingPageAction = {
      action,
      text,
      editable: !!msg.payload?.editable,
      sourceTabId: sender.tab?.id || null,
      url: msg.payload?.url || sender.tab?.url || '',
      title: msg.payload?.title || sender.tab?.title || '',
      target: 'side_panel',
      autoSend: true,
      time: Date.now()
    };

    lastNormalWindowId = targetWindowId;
    chatHostWindowId = targetWindowId;
    chrome.storage.local.set({ pendingPageAction }, () => {
      chrome.sidePanel.open({ windowId: targetWindowId }).then(() => {
        chrome.windows.update(targetWindowId, { focused: true }).catch(() => {});
        sendResponse({ ok: true, windowId: targetWindowId });
      }).catch(err => {
        sendResponse({ ok: false, error: err?.message || 'open_side_panel_failed' });
      });
    });
    return true;
  }

  if (msg.type === 'OPEN_SIDE_PANEL') {
    if (!chrome.sidePanel?.open) {
      sendResponse({ ok: false, error: 'side_panel_unsupported' });
      return false;
    }

    const targetWindowId = msg.windowId || sender.tab?.windowId || chatHostWindowId || lastNormalWindowId;
    if (!targetWindowId) {
      sendResponse({ ok: false, error: 'window_not_found' });
      return false;
    }

    lastNormalWindowId = targetWindowId;
    chatHostWindowId = targetWindowId;
    chrome.sidePanel.open({ windowId: targetWindowId }).then(() => {
      chrome.windows.update(targetWindowId, { focused: true }).catch(() => {});
      sendResponse({ ok: true, windowId: targetWindowId });
    }).catch(err => {
      sendResponse({ ok: false, error: err?.message || 'open_side_panel_failed' });
    });
    return true;
  }

  if (msg.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true;
  }

  // Find the chat page tab
  if (msg.type === 'FIND_CHAT_TAB') {
    chrome.tabs.query({}, (tabs) => {
      const chatTab = tabs.find(t => t.url && t.url.includes('chat.html'));
      sendResponse(chatTab ? { tabId: chatTab.id } : { tabId: null });
    });
    return true;
  }

  // Content script finished region select — crop and store
  if (msg.type === 'REGION_SELECTED') {
    const { rect } = msg;
    chrome.storage.local.get('_screenshotFull', (d) => {
      if (!d._screenshotFull) return;
      // Use offscreen canvas via data URL — do crop in content script side isn't possible here
      // Store rect + full screenshot, popup will crop on next open
      chrome.storage.local.set({
        pendingScreenshot: { full: d._screenshotFull, rect },
        _screenshotFull: null
      });
      chrome.storage.local.remove('_screenshotFull');
    });
    sendResponse({ ok: true });
    return true;
  }
});
