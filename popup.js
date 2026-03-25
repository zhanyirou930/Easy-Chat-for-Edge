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

chrome.storage.local.get(['profiles', 'currentProfile', 'sessions', 'currentPopupSessionId', 'pendingScreenshot', 'config', 'webSearchEnabled'], (data) => {
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
  currentId = data.currentPopupSessionId || sessions[0]?.id || null;
  if (currentId && !sessions.find(s => s.id === currentId)) currentId = sessions[0]?.id || null;

  renderSessionList();
  if (currentId) loadSession(currentId);

  // Restore web search toggle state
  webSearchEnabled = !!data.webSearchEnabled;
  document.getElementById('btnWebSearch').classList.toggle('active', webSearchEnabled);

  if (data.pendingScreenshot) {
    processPendingScreenshot(data.pendingScreenshot);
  }
});

function save() {
  chrome.storage.local.set({ sessions, currentPopupSessionId: currentId });
}

let proxyStreaming = false; // true while a PROXY_SEND round-trip is in progress

function processPendingScreenshot(ps) {
  if (!ps) return;
  chrome.storage.local.remove('pendingScreenshot');
  if (typeof ps === 'string') applyPendingScreenshot(ps);
  else if (ps.full && ps.rect) cropAndApply(ps.full, ps.rect);
}

// ── Cross-window sync ──
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.pendingScreenshot?.newValue) {
    processPendingScreenshot(changes.pendingScreenshot.newValue);
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
        renderBubble(bubble, m.content);
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
    if (!chatSyncBubble || chatSyncSessionId !== msg.sessionId) {
      chatSyncBubble = addBubble('ai', '');
      chatSyncSessionId = msg.sessionId;
    }
    renderBubble(chatSyncBubble, msg.full);
    scrollBottom();
  } else if (msg.type === 'CHAT_DONE') {
    if (chatSyncBubble) {
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
      proxyStreaming = false;
    });
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
  zh: { newChat: '新对话', history: '历史', sidebarUI: '侧边栏 ▕', fullUI: '完整界面 ↗', quickChat: '快速对话', send: '发送消息...', screenshotHint: '描述你想问的问题...', contextHint: '补充说明（可选）...', noApiKey: '未配置 API Key', noApiKeyHint: '请在完整界面设置', explainLabel: '代码解释', summarizeLabel: '总结网页', rewriteLabel: '改写/翻译', webSearchLabel: '联网搜索', sidebarUnavailable: '当前浏览器不支持扩展侧边栏', sidebarOpenFailed: '打开侧边栏失败', fullOpenFailed: '打开完整界面失败' },
  en: { newChat: 'New Chat', history: 'History', sidebarUI: 'Sidebar ▕', fullUI: 'Full UI ↗', quickChat: 'Quick Chat', send: 'Send a message...', screenshotHint: 'Describe what you want to ask...', contextHint: 'Add context (optional)...', noApiKey: 'API Key not set', noApiKeyHint: 'Configure in full UI', explainLabel: 'Explain Code', summarizeLabel: 'Summarize Page', rewriteLabel: 'Rewrite/Translate', webSearchLabel: 'Web Search', sidebarUnavailable: 'This browser does not support extension side panel', sidebarOpenFailed: 'Failed to open side panel', fullOpenFailed: 'Failed to open full window' },
};

function applyLanguage(lang) {
  const L = LANG[lang] || LANG.zh;
  document.getElementById('btnNewChat').title = L.newChat;
  document.getElementById('historyBtn').childNodes[0].textContent = L.history + ' ';
  document.getElementById('openSidebarBtn').textContent = L.sidebarUI;
  document.getElementById('openFullBtn').textContent = L.fullUI;
  document.querySelector('.section-title').textContent = L.quickChat;
  quickInput.placeholder = L.send;
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
      if (m.display) {
        bubble.textContent = m.display;
      } else {
        const text = typeof m.content === 'string' ? m.content
          : m.content.find?.(p => p.type === 'text')?.text || '';
        renderBubble(bubble, text);
      }
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
document.getElementById('openSidebarBtn').addEventListener('click', () => {
  openSidebar();
});

document.getElementById('openFullBtn').addEventListener('click', async () => {
  const L = LANG[config.language] || LANG.zh;
  const res = await bgMessage({ type: 'OPEN_CHAT_WINDOW', sourceWindowId: hostWindowId });
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
  quickInput.placeholder = LANG[config.language]?.send || '发送消息...';
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
    const typingEl = addTyping();
    searchResult = await tavilySearch(userText);
    typingEl.remove();
  }

  // Try to proxy to open chat page, fallback to local doRequest
  const chatTabRes = await bgMessage({ type: 'FIND_CHAT_TAB' });
  if (chatTabRes?.tabId) {
    await doRequestViaChat(chatTabRes.tabId, s, searchResult);
  } else {
    await doRequest(s, searchResult);
  }
}

// ── Tool buttons ──
document.getElementById('btnScreenshot').addEventListener('click', handleScreenshot);
document.getElementById('btnExplainCode').addEventListener('click', () => handleContextAttach('explain'));
document.getElementById('btnRewrite').addEventListener('click', () => handleContextAttach('rewrite'));
document.getElementById('btnSummarize').addEventListener('click', () => handleContextAttach('summarize'));
document.getElementById('btnAnnotate').addEventListener('click', handleAnnotate);

document.getElementById('btnWebSearch').addEventListener('click', () => {
  webSearchEnabled = !webSearchEnabled;
  chrome.storage.local.set({ webSearchEnabled });
  document.getElementById('btnWebSearch').classList.toggle('active', webSearchEnabled);
});

// ── Context attachment (explain / summarize / rewrite) ──
async function handleContextAttach(type) {
  const tab = await getActiveTab();
  if (!tab) return;

  if (type === 'explain' || type === 'rewrite') {
    // Ensure content script is injected (needed for file:// pages with permission granted)
    await new Promise(resolve => {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, () => resolve());
    });
    const resp = await tabMessage(tab.id, { type: 'GET_SELECTION' });
    const text = resp?.text || '';
    if (!text) {
      const url = tab.url || '';
      if (url.startsWith('file://')) toast('本地文件需在扩展管理页开启"允许访问文件网址"');
      else toast(type === 'explain' ? '请先在页面选中代码' : '请先在页面选中文字');
      return;
    }
    if (type === 'explain') {
      pendingContext = {
        type: 'explain', icon: '💻',
        label: LANG[config.language]?.explainLabel || '代码解释',
        meta: {
          contextSources: [EasyChatCore.createContextSource('selection', {
            label: LANG[config.language]?.explainLabel || '代码解释',
            preview: EasyChatCore.previewText(text),
            chars: text.length,
            url: tab.url,
            title: tab.title
          })]
        },
        promptFn: (userText) =>
          `请解释以下代码，说明它的功能、逻辑和关键点${userText ? '，并结合用户问题：' + userText : ''}：\n\n\`\`\`\n${text}\n\`\`\``
      };
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
  if (!pendingContext) { wrap.style.display = 'none'; return; }
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
  // update placeholder
  quickInput.placeholder = LANG[config.language]?.contextHint || '补充说明（可选）...';
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
    addBubble('ai', reply);
    s.messages.push(EasyChatCore.createAssistantMessage({
      content: result,
      display: reply,
      meta: {
        annotationCount: annotations.length
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

  const aiBubble = addBubble('ai', '');
  let full = '', lastRender = 0;

  // Listen for chunks relayed back from background
  const onMsg = (msg) => {
    if (msg.type === 'PROXY_CHUNK') {
      full = msg.full;
      const now = Date.now();
      if (now - lastRender > 80) {
        renderBubble(aiBubble, full);
        lastRender = now;
        scrollBottom();
      }
    } else if (msg.type === 'PROXY_DONE') {
      renderBubble(aiBubble, msg.full);
      scrollBottom();
      // Session already saved by chat page; reload from storage to stay in sync
      chrome.storage.local.get(['sessions'], (data) => {
        if (data.sessions) {
          sessions = data.sessions;
          const updated = sessions.find(x => x.id === s.id);
          if (updated) Object.assign(s, updated);
        }
        cleanup();
      });
    } else if (msg.type === 'PROXY_ERROR') {
      aiBubble.textContent = '错误: ' + msg.error;
      cleanup();
    }
  };

  const cleanup = () => {
    chrome.runtime.onMessage.removeListener(onMsg);
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
      doRequest(s, searchResult);
    }
  });
}

function toApiContent(content) {
  return EasyChatCore.toApiContent(content);
}

// ── API call (streaming) ──
async function doRequest(s, searchResult) {
  streaming = true;
  sendBtn.style.display = 'none';
  stopBtn.style.display = 'flex';
  abortController = new AbortController();

  const baseUrl = EasyChatCore.normalizeBaseUrl(config.baseUrl);

  const msgs = s.messages.map(m => ({ role: m.role, content: toApiContent(m.content) }));

  EasyChatCore.appendSearchResultToLastUserMessage(msgs, searchResult, '联网搜索结果');

  const sysPrompt = EasyChatCore.buildSystemMessage(
    config.systemPrompt,
    'Always format responses using Markdown.',
    'You are a helpful assistant. Format responses using Markdown.'
  );
  const apiMsgs = [{ role: 'system', content: sysPrompt }, ...msgs];

  const body = EasyChatCore.buildChatRequestBody({
    model: config.model || 'gpt-4o',
    messages: apiMsgs,
    stream: true,
    temperature: config.temperature ?? 0.7,
    topP: config.topP ?? 1.0,
    frequencyPenalty: config.frequencyPenalty ?? 0.0,
    presencePenalty: config.presencePenalty ?? 0.0,
    maxTokens: config.maxTokens
  });

  const typingEl = addTyping();

  try {
    const aiBubble = addBubble('ai', '');
    let lastRender = 0;
    typingEl.remove();
    const { full } = await EasyChatCore.streamChatCompletion({
      baseUrl,
      apiKey: config.apiKey,
      body,
      signal: abortController.signal,
      onChunk: ({ full }) => {
        const now = Date.now();
        if (now - lastRender > 80) {
          renderBubble(aiBubble, full);
          lastRender = now;
          scrollBottom();
        }
      }
    });
    renderBubble(aiBubble, full);
    scrollBottom();
    s.messages.push(EasyChatCore.createAssistantMessage({ content: full, time: Date.now() }));
    save();

  } catch (e) {
    typingEl?.remove();
    if (e.name !== 'AbortError') addBubble('ai', '错误: ' + e.message);
  } finally {
    streaming = false;
    sendBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
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

// Render a user bubble that has a display string (may contain icon+label prefix)
// Format: "🌐 联网搜索  user text" or "💻 代码解释" (no extra text)
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

function addTyping() {
  const row = document.createElement('div');
  row.className = 'msg ai';
  const av = document.createElement('div');
  av.className = 'msg-avatar ai';
  if (config.aiAvatar) {
    const img = document.createElement('img');
    img.src = config.aiAvatar;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    av.appendChild(img);
  } else {
    av.textContent = '🤖';
  }
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
  row.appendChild(av); row.appendChild(bubble);
  messagesArea.appendChild(row);
  scrollBottom();
  return row;
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
    onMissingKey: () => toast('请先在完整界面配置搜索 API Key')
  });
}
