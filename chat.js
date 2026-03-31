// ── State ──
console.log('[GPT] marked available:', typeof marked, typeof marked !== 'undefined' ? marked.parse('**test**') : 'N/A');
let sessions = [];
let currentId = null;
let config = {
  baseUrl: '',
  apiKey: '',
  systemPrompt: '',
  temperature: 0.7,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  maxTokens: '',
  contextLimit: '',
  searchEngine: 'tavily',
  searchApiKey: '',
  customSearchUrl: '',
  customSearchUrl2: '',
  customSearchUrl3: '',
  streamEnabled: true,
  userAvatar: '',
  aiAvatar: '',
  model: 'gpt-4o',
  language: 'en'
};
let profiles = {};
let currentProfile = 'default';
let streaming = false;
let abortController = null;
let attachments = [];
let autoScroll = true;
let webSearchEnabled = false;
let tokenUsage = {}; // { modelName: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
let currentLanguage = 'en';
let draftSourceContext = null;
let hostWindowId = (() => {
  const raw = new URLSearchParams(location.search).get('sourceWindowId');
  const num = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(num) ? num : null;
})();
const initialSessionId = (() => {
  const raw = new URLSearchParams(location.search).get('sessionId');
  return raw ? String(raw) : '';
})();
let typingFlipState = null;
const markdownRenderCache = new Map();
const MARKDOWN_RENDER_CACHE_LIMIT = 120;
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

// ── Language Translations ──
const translations = {
  zh: {
    newChat: '新对话',
    sidebarBtn: '侧边栏 ▕',
    export: '导出',
    clear: '清空',
    webSearchOn: '联网搜索（已开启）',
    webSearchOff: '联网搜索（已关闭）',
    send: '发送',
    placeholder: '发送消息...',
    inputHint: 'Enter 发送 · Shift+Enter 换行 · Ctrl+N 新对话',
    welcomeTitle: 'EasyChat for Edge',
    welcomeDesc: '支持 Markdown · 图片 · 文件 · 流式输出',
    currentProfileLabel: '当前配置',
    shortcutNew: '新对话',
    shortcutFocus: '聚焦输入',
    shortcutExport: '导出对话',
    searchPlaceholder: '搜索模型...',
    settings: '⚙️ 设置',
    apiConfig: 'API 配置',
    aiParams: 'AI 参数',
    interfaceSettings: '界面设置',
    profilesManagement: '配置文件',
    dataManagement: '数据管理',
    sidebarTitle: 'API 设置 / 参数',
    profilesTitle: '📋 配置文件管理',
    newProfilePlaceholder: '新配置文件名称',
    createBtn: '创建',
    closeBtn: '关闭',
    saveBtn: '保存',
    cancelBtn: '取消',
    testConnection: '🔌 测试连接',
    clearAllConversations: '🗑️ 清除所有对话',
    uploadImage: '上传图片',
    clearImage: '清除',
    uploadBtn: '上传图片',
    clearBtn: '清除',
    confirmDelete: '确认删除',
    confirmCancel: '取消',
    uploadImageTitle: '上传图片 (支持粘贴)',
    uploadFileTitle: '上传文件',
    clearAllDataWarning: '此操作将清除所有对话、配置、头像等数据',
    loadBtn: '加载',
    deleteBtn: '删除',
    avatarUploaded: '已上传自定义头像',
    deleteConversation: '删除这条对话？',
    conversationDeleted: '对话已删除',
    messageDeleted: '消息已删除',
    clearAllDataConfirm: '⚠️ 警告：此操作将清除所有数据，包括对话、配置、头像等，且不可恢复！确定要继续吗？',
    userAvatarUploaded: '用户头像已上传',
    aiAvatarUploaded: 'AI 头像已上传',
    profileLoaded: '已加载配置文件',
    cannotDeleteDefault: '无法删除默认配置',
    cannotDeleteCurrent: '无法删除当前使用的配置',
    confirmDeleteProfile: '确定要删除配置文件',
    profileDeleted: '配置文件已删除',
    copy: '复制',
    copied: '已复制',
    copiedCheck: '已复制 ✓',
    sourceOpened: '已打开来源页面',
    sourceCopied: '已复制来源摘要',
    sourceUnavailable: '此来源暂时没有可打开内容',
    sourceDetailHint: '点击查看来源详情',
    sourceDetailsTitle: '来源详情',
    sourcePreviewTitle: '内容摘录',
    sourceOpenBtn: '打开原页',
    sourceCopyBtn: '复制摘要',
    sourceLocateBtn: '定位来源',
    sourceLocated: '已定位到来源位置',
    sourceLocateFallback: '已打开来源页面，但未找到对应文本',
    sourceLocatedPreview: '已按摘录定位到来源位置',
    sourceLocatedTitle: '已按标题定位到来源位置',
    sourceLocatedLoose: '已通过宽松匹配定位到来源位置',
    sourceAskBtn: '问这个来源',
    sourceAskLabel: '来源追问',
    sourceAskReady: '已附加来源上下文',
    sourceQuestionHint: '补充你想问这个来源的问题...',
    sourcesAskBtn: '问这些来源',
    sourcesAskLabel: '多来源追问',
    sourcesQuestionHint: '补充你想问这些来源的问题...',
    applyToPage: '回填到页面',
    applySuccess: '已回填到页面',
    applyNoTarget: '页面中没有可回填的位置',
    applySelectionOnly: '当前选中的不是可编辑内容',
    applyReadOnly: '当前输入框不可编辑',
    applyBuiltinPage: '浏览器内置页面无法回填',
    applyFailed: '回填失败',
    thinkingTitle: 'AI 正在思考',
    thinkingHint: '请求已发出，正在等待回复',
    regenerate: '重新生成',
    editResend: '编辑重发',
    customModel: '自定义模型...',
    referenceSource: '参考来源：',
    searchResults: '搜索结果：',
    noTitle: '无标题',
    settingsSaved: '设置已保存',
    pleaseEnterApiKey: '请先填写 API Key',
    testing: '测试中...',
    connecting: '正在连接...',
    confirmClearChat: '清空当前对话？',
    chatCleared: '对话已清空',
    noContentToExport: '没有内容可导出',
    exportedMarkdown: '已导出 Markdown',
    renamed: '已重命名',
    renameBtn: '重命名',
    generationStopped: '已停止生成',
    confirmClearAllChats: '确定要清除所有对话吗？此操作不可恢复！',
    allChatsCleared: '所有对话已清除',
    allDataCleared: '所有数据已清除',
    confirmClearTokenStats: '确定要清除所有 Token 使用统计吗？',
    userAvatarCleared: '用户头像已清除',
    pleaseEnterProfileName: '请输入配置文件名称',
    profileExists: '配置文件已存在',
    searchConversations: '搜索对话...',
    messages: '消息',
    characters: '字符',
    stopGeneration: '停止生成',
    baseUrlHint: '第三方转发地址，留空使用官方',
    systemPromptLabel: 'System Prompt（AI 角色设定）',
    systemPromptPlaceholder: '你是一个有帮助的 AI 助手...',
    temperatureLabel: 'Temperature（创造性）',
    temperatureHint: '0 = 精确稳定，2 = 更有创意',
    topPLabel: 'Top P（采样范围）',
    topPHint: '控制生成文本的多样性，0.1 = 保守，1.0 = 多样',
    frequencyPenaltyLabel: 'Frequency Penalty（频率惩罚）',
    frequencyPenaltyHint: '降低重复词汇的概率，-2 到 2',
    presencePenaltyLabel: 'Presence Penalty（存在惩罚）',
    presencePenaltyHint: '鼓励谈论新话题，-2 到 2',
    maxTokensLabel: '最大 Token',
    maxTokensPlaceholder: '不限制',
    contextLimitLabel: '上下文消息数',
    contextLimitPlaceholder: '全部',
    contextLimitHint: '限制发送的历史条数',
    noData: '暂无数据',
    sidebarUnavailable: '当前浏览器不支持扩展侧边栏',
    sidebarOpenFailed: '打开侧边栏失败',
    fullOpenFailed: '打开完整界面失败',
    switchedToModel: '已切换到 {name}',
    connectionOk: '✅ 连接成功！回复: "{reply}"\nURL: {url}',
    connectionFailed: '❌ 失败: {msg}\nURL: {url}',
    networkError: '❌ 网络错误: {msg}\nURL: {url}',
    requestFailed: '请求失败',
    exportUser: '👤 用户',
    exportAI: '🤖 AI'
  },
  en: {
    newChat: 'New Chat',
    sidebarBtn: 'Sidebar ▕',
    export: 'Export',
    clear: 'Clear',
    webSearchOn: 'Web Search (ON)',
    webSearchOff: 'Web Search (OFF)',
    send: 'Send',
    placeholder: 'Send a message...',
    inputHint: 'Enter to send · Shift+Enter for new line · Ctrl+N for new chat',
    welcomeTitle: 'EasyChat for Edge',
    welcomeDesc: 'Support Markdown · Images · Files · Streaming',
    currentProfileLabel: 'Current Profile',
    shortcutNew: 'New Chat',
    shortcutFocus: 'Focus Input',
    shortcutExport: 'Export Chat',
    searchPlaceholder: 'Search models...',
    settings: '⚙️ Settings',
    apiConfig: 'API Config',
    aiParams: 'AI Parameters',
    interfaceSettings: 'Interface',
    profilesManagement: 'Profiles',
    dataManagement: 'Data',
    sidebarTitle: 'API Settings / Parameters',
    profilesTitle: '📋 Profile Management',
    newProfilePlaceholder: 'New profile name',
    createBtn: 'Create',
    closeBtn: 'Close',
    saveBtn: 'Save',
    cancelBtn: 'Cancel',
    testConnection: '🔌 Test Connection',
    clearAllConversations: '🗑️ Clear All Conversations',
    uploadImage: 'Upload Image',
    clearImage: 'Clear',
    uploadBtn: 'Upload',
    clearBtn: 'Clear',
    confirmDelete: 'Confirm Delete',
    confirmCancel: 'Cancel',
    uploadImageTitle: 'Upload Image (Paste supported)',
    uploadFileTitle: 'Upload File',
    clearAllDataWarning: 'This will clear all conversations, configs, avatars and data',
    loadBtn: 'Load',
    deleteBtn: 'Delete',
    avatarUploaded: 'Custom avatar uploaded',
    deleteConversation: 'Delete this conversation?',
    conversationDeleted: 'Conversation deleted',
    messageDeleted: 'Message deleted',
    clearAllDataConfirm: '⚠️ Warning: This will clear all data including conversations, configs, avatars, etc. and cannot be undone! Continue?',
    userAvatarUploaded: 'User avatar uploaded',
    aiAvatarUploaded: 'AI avatar uploaded',
    profileLoaded: 'Profile loaded',
    cannotDeleteDefault: 'Cannot delete default profile',
    cannotDeleteCurrent: 'Cannot delete current profile',
    confirmDeleteProfile: 'Confirm delete profile',
    profileDeleted: 'Profile deleted',
    copy: 'Copy',
    copied: 'Copied',
    copiedCheck: 'Copied ✓',
    sourceOpened: 'Opened source page',
    sourceCopied: 'Copied source summary',
    sourceUnavailable: 'This source has no openable details',
    sourceDetailHint: 'Click to view source details',
    sourceDetailsTitle: 'Source Details',
    sourcePreviewTitle: 'Excerpt',
    sourceOpenBtn: 'Open Page',
    sourceCopyBtn: 'Copy Summary',
    sourceLocateBtn: 'Locate Source',
    sourceLocated: 'Located the source on page',
    sourceLocateFallback: 'Opened the source page, but could not find the exact text',
    sourceLocatedPreview: 'Located the source using the excerpt',
    sourceLocatedTitle: 'Located the source using the title',
    sourceLocatedLoose: 'Located the source using a loose match',
    sourceAskBtn: 'Ask This Source',
    sourceAskLabel: 'Source Follow-up',
    sourceAskReady: 'Source attached to composer',
    sourceQuestionHint: 'Ask a follow-up about this source...',
    sourcesAskBtn: 'Ask These Sources',
    sourcesAskLabel: 'Sources Follow-up',
    sourcesQuestionHint: 'Ask a follow-up about these sources...',
    applyToPage: 'Apply to Page',
    applySuccess: 'Applied to page',
    applyNoTarget: 'No editable target found on page',
    applySelectionOnly: 'The selected content is not editable',
    applyReadOnly: 'The current input is read-only',
    applyBuiltinPage: 'Cannot apply on browser built-in pages',
    applyFailed: 'Apply failed',
    thinkingTitle: 'AI is thinking',
    thinkingHint: 'Request sent, waiting for the first reply',
    regenerate: 'Regenerate',
    editResend: 'Edit & Resend',
    customModel: 'Custom Model...',
    referenceSource: 'Reference Sources:',
    searchResults: 'Search Results:',
    noTitle: 'Untitled',
    settingsSaved: 'Settings saved',
    pleaseEnterApiKey: 'Please enter API Key',
    testing: 'Testing...',
    connecting: 'Connecting...',
    confirmClearChat: 'Clear current chat?',
    chatCleared: 'Chat cleared',
    noContentToExport: 'No content to export',
    exportedMarkdown: 'Exported Markdown',
    renamed: 'Renamed',
    renameBtn: 'Rename',
    generationStopped: 'Generation stopped',
    confirmClearAllChats: 'Clear all conversations? This cannot be undone!',
    allChatsCleared: 'All conversations cleared',
    allDataCleared: 'All data cleared',
    confirmClearTokenStats: 'Clear all token usage statistics?',
    userAvatarCleared: 'User avatar cleared',
    pleaseEnterProfileName: 'Please enter profile name',
    profileExists: 'Profile already exists',
    searchConversations: 'Search conversations...',
    messages: 'Messages',
    characters: 'Characters',
    stopGeneration: 'Stop generation',
    baseUrlHint: 'Third-party API endpoint, leave empty for official',
    systemPromptLabel: 'System Prompt (AI Role)',
    systemPromptPlaceholder: 'You are a helpful AI assistant...',
    temperatureLabel: 'Temperature (Creativity)',
    temperatureHint: '0 = precise & stable, 2 = more creative',
    topPLabel: 'Top P (Sampling)',
    topPHint: 'Controls diversity, 0.1 = conservative, 1.0 = diverse',
    frequencyPenaltyLabel: 'Frequency Penalty',
    frequencyPenaltyHint: 'Reduces repetition, -2 to 2',
    presencePenaltyLabel: 'Presence Penalty',
    presencePenaltyHint: 'Encourages new topics, -2 to 2',
    maxTokensLabel: 'Max Tokens',
    maxTokensPlaceholder: 'Unlimited',
    contextLimitLabel: 'Context Messages',
    contextLimitPlaceholder: 'All',
    contextLimitHint: 'Limit number of history messages sent',
    noData: 'No data yet',
    sidebarUnavailable: 'This browser does not support extension side panel',
    sidebarOpenFailed: 'Failed to open side panel',
    fullOpenFailed: 'Failed to open full window',
    switchedToModel: 'Switched to {name}',
    connectionOk: '✅ Connected! Reply: "{reply}"\nURL: {url}',
    connectionFailed: '❌ Failed: {msg}\nURL: {url}',
    networkError: '❌ Network error: {msg}\nURL: {url}',
    requestFailed: 'Request failed',
    exportUser: '👤 User',
    exportAI: '🤖 AI'
  }
};

function t(key) {
  return translations[currentLanguage]?.[key] || translations.zh[key] || key;
}

function bgMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}

function tabMessage(tabId, msg) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

async function getApplyTargetTab() {
  const res = await bgMessage({ type: 'GET_HOST_ACTIVE_TAB', windowId: hostWindowId });
  return res?.ok ? res : null;
}

function canApplyAssistantMessage(message) {
  return message?.role === 'assistant' && !message.display && !!EasyChatCore.extractPlainText(message.content).trim();
}

function getApplyErrorMessage(error) {
  if (error === 'selection_not_editable') return t('applySelectionOnly');
  if (error === 'no_editable_target' || error === 'host_tab_not_found') return t('applyNoTarget');
  if (error === 'input_read_only') return t('applyReadOnly');
  return t('applyFailed');
}

async function applyAssistantMessageToPage(message) {
  const text = EasyChatCore.extractPlainText(message?.content).trim();
  if (!text) {
    toast(t('applyFailed'));
    return;
  }

  const tab = await getApplyTargetTab();
  if (!tab?.tabId) {
    toast(t('applyNoTarget'));
    return;
  }

  if (/^(edge|chrome|about):/i.test(tab.url || '')) {
    toast(t('applyBuiltinPage'));
    return;
  }

  await new Promise(resolve => {
    chrome.scripting.executeScript({ target: { tabId: tab.tabId }, files: ['content.js'] }, () => resolve());
  });

  const resp = await tabMessage(tab.tabId, { type: 'APPLY_ASSISTANT_TEXT', text });
  if (resp?.ok) toast(t('applySuccess'));
  else toast(getApplyErrorMessage(resp?.error));
}

async function openSidebar() {
  const res = await bgMessage({ type: 'OPEN_SIDE_PANEL', windowId: hostWindowId });
  if (res?.ok) return;
  if (res?.error === 'side_panel_unsupported') {
    toast(t('sidebarUnavailable'));
    return;
  }
  console.error('[EasyChat] openSidebar failed:', res?.error || 'unknown_error');
  toast(t('sidebarOpenFailed'));
}

// ── Model Data ──
const modelData = {
  'openai': {
    name: '🔥 OpenAI',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', badge: 'Latest' },
      { id: 'gpt-5.4-thinking', name: 'GPT-5.4 Thinking' },
      { id: 'gpt-5.3', name: 'GPT-5.3' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
      { id: 'gpt-5.2', name: 'GPT-5.2' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex' },
      { id: 'gpt-5.1', name: 'GPT-5.1' },
      { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'gpt-5-codex', name: 'GPT-5 Codex' },
      { id: 'gpt-4o', name: 'GPT-4o', badge: 'Popular' },
      { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest' },
      { id: 'gpt-4o-2024-11-20', name: 'GPT-4o (2024-11-20)' },
      { id: 'gpt-4o-2024-08-06', name: 'GPT-4o (2024-08-06)' },
      { id: 'gpt-4o-2024-05-13', name: 'GPT-4o (2024-05-13)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini (2024-07-18)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-4-turbo-2024-04-09', name: 'GPT-4 Turbo (2024-04-09)' },
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview' },
      { id: 'gpt-4-0125-preview', name: 'GPT-4 (0125-preview)' },
      { id: 'gpt-4-1106-preview', name: 'GPT-4 (1106-preview)' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-4-0613', name: 'GPT-4 (0613)' },
      { id: 'gpt-4-0314', name: 'GPT-4 (0314)' },
      { id: 'gpt-4-32k', name: 'GPT-4 32K' },
      { id: 'gpt-4-32k-0613', name: 'GPT-4 32K (0613)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      { id: 'gpt-3.5-turbo-0125', name: 'GPT-3.5 Turbo (0125)' },
      { id: 'gpt-3.5-turbo-1106', name: 'GPT-3.5 Turbo (1106)' },
      { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K' },
      { id: 'o1', name: 'o1', badge: 'Reasoning' },
      { id: 'o1-2024-12-17', name: 'o1 (2024-12-17)' },
      { id: 'o1-preview', name: 'o1 Preview' },
      { id: 'o1-preview-2024-09-12', name: 'o1 Preview (2024-09-12)' },
      { id: 'o1-mini', name: 'o1 Mini' },
      { id: 'o1-mini-2024-09-12', name: 'o1 Mini (2024-09-12)' },
      { id: 'o3-mini', name: 'o3 Mini' },
      { id: 'o3-mini-2025-01-31', name: 'o3 Mini (2025-01-31)' }
    ]
  },
  'anthropic': {
    name: '🤖 Anthropic',
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', badge: 'Latest' },
      { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 Thinking' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (20250514)' },
      { id: 'claude-sonnet-4-20250514-thinking', name: 'Claude Sonnet 4 Thinking (20250514)' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (20250929)' },
      { id: 'claude-sonnet-4-5-20250929-thinking', name: 'Claude Sonnet 4.5 Thinking (20250929)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', badge: 'Popular' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (20250219)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (20241022)' },
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (20240620)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (20241022)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (20240229)' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet (20240229)' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (20240307)' },
      { id: 'claude-2.1', name: 'Claude 2.1' },
      { id: 'claude-2.0', name: 'Claude 2.0' },
      { id: 'claude-instant-1.2', name: 'Claude Instant 1.2' }
    ]
  },
  'google': {
    name: '✨ Google',
    models: [
      { id: 'gemini-2.5-pro-exp', name: 'Gemini 2.5 Pro Exp', badge: 'Latest' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp' },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking Exp' },
      { id: 'gemini-2.0-flash-thinking-exp-1219', name: 'Gemini 2.0 Flash Thinking (1219)' },
      { id: 'gemini-exp-1206', name: 'Gemini Exp 1206' },
      { id: 'gemini-exp-1121', name: 'Gemini Exp 1121' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', badge: 'Popular' },
      { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro Latest' },
      { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro 002' },
      { id: 'gemini-1.5-pro-001', name: 'Gemini 1.5 Pro 001' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash Latest' },
      { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash 002' },
      { id: 'gemini-1.5-flash-001', name: 'Gemini 1.5 Flash 001' },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B' },
      { id: 'gemini-1.5-flash-8b-latest', name: 'Gemini 1.5 Flash 8B Latest' },
      { id: 'gemini-1.5-flash-8b-001', name: 'Gemini 1.5 Flash 8B 001' },
      { id: 'gemini-pro', name: 'Gemini Pro' },
      { id: 'gemini-pro-vision', name: 'Gemini Pro Vision' }
    ]
  },
  'deepseek': {
    name: '🚀 DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', badge: 'Popular' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', badge: 'Reasoning' },
      { id: 'deepseek-r1', name: 'DeepSeek R1' },
      { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B' },
      { id: 'deepseek-r1-distill-qwen-14b', name: 'DeepSeek R1 Distill Qwen 14B' },
      { id: 'deepseek-r1-distill-qwen-7b', name: 'DeepSeek R1 Distill Qwen 7B' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B' },
      { id: 'deepseek-r1-distill-llama-8b', name: 'DeepSeek R1 Distill Llama 8B' },
      { id: 'deepseek-v3', name: 'DeepSeek V3' },
      { id: 'deepseek-v2.5', name: 'DeepSeek V2.5' },
      { id: 'deepseek-v2', name: 'DeepSeek V2' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' }
    ]
  },
  'qwen': {
    name: '🌟 通义千问',
    models: [
      { id: 'qwen-max', name: 'Qwen Max', badge: 'Popular' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
      { id: 'qwen-long', name: 'Qwen Long' },
      { id: 'qwen2.5-72b-instruct', name: 'Qwen 2.5 72B' },
      { id: 'qwq-32b-preview', name: 'QwQ 32B' }
    ]
  },
  'glm': {
    name: '💎 智谱 GLM',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
      { id: 'glm-4-air', name: 'GLM-4 Air' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash' },
      { id: 'glm-4', name: 'GLM-4' }
    ]
  },
  'ernie': {
    name: '🔮 百度文心',
    models: [
      { id: 'ernie-4.0-turbo-8k', name: 'ERNIE 4.0 Turbo' },
      { id: 'ernie-3.5-8k', name: 'ERNIE 3.5' },
      { id: 'ernie-speed-128k', name: 'ERNIE Speed' },
      { id: 'ernie-lite-8k', name: 'ERNIE Lite' }
    ]
  },
  'moonshot': {
    name: '🌙 月之暗面',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' }
    ]
  },
  'yi': {
    name: '🎯 零一万物',
    models: [
      { id: 'yi-large', name: 'Yi Large' },
      { id: 'yi-medium', name: 'Yi Medium' },
      { id: 'yi-spark', name: 'Yi Spark' }
    ]
  },
  'doubao': {
    name: '🎨 字节豆包',
    models: [
      { id: 'doubao-pro-32k', name: '豆包 Pro 32K' },
      { id: 'doubao-lite-32k', name: '豆包 Lite 32K' }
    ]
  },
  'spark': {
    name: '⚡ 讯飞星火',
    models: [
      { id: 'spark-max', name: '星火 Max' },
      { id: 'spark-pro', name: '星火 Pro' },
      { id: 'spark-lite', name: '星火 Lite' }
    ]
  },
  'hunyuan': {
    name: '🐧 腾讯混元',
    models: [
      { id: 'hunyuan-pro', name: '混元 Pro' },
      { id: 'hunyuan-standard', name: '混元 Standard' },
      { id: 'hunyuan-lite', name: '混元 Lite' }
    ]
  },
  'llama': {
    name: '🦙 Meta Llama',
    models: [
      { id: 'llama-3.3-70b-instruct', name: 'Llama 3.3 70B', badge: 'Latest' },
      { id: 'llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
      { id: 'llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
      { id: 'llama-3.1-8b-instruct', name: 'Llama 3.1 8B' }
    ]
  },
  'mistral': {
    name: '🌊 Mistral AI',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium' },
      { id: 'mixtral-8x7b-instruct', name: 'Mixtral 8x7B' },
      { id: 'mixtral-8x22b-instruct', name: 'Mixtral 8x22B' }
    ]
  },
  'grok': {
    name: '🎯 xAI Grok',
    models: [
      { id: 'grok-4.20-beta', name: 'Grok 4.20 Beta', badge: 'Latest' },
      { id: 'grok-4.1', name: 'Grok 4.1' },
      { id: 'grok-4.1-expert', name: 'Grok 4.1 Expert' },
      { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast' },
      { id: 'grok-4.1-mini', name: 'Grok 4.1 Mini' },
      { id: 'grok-4.1-thinking', name: 'Grok 4.1 Thinking' },
      { id: 'grok-4', name: 'Grok 4', badge: 'Popular' },
      { id: 'grok-4-expert', name: 'Grok 4 Expert' },
      { id: 'grok-4-fast', name: 'Grok 4 Fast' },
      { id: 'grok-4-fast-expert', name: 'Grok 4 Fast Expert' },
      { id: 'grok-4-heavy', name: 'Grok 4 Heavy' },
      { id: 'grok-4-mini', name: 'Grok 4 Mini' },
      { id: 'grok-4-thinking', name: 'Grok 4 Thinking' },
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-3-fast', name: 'Grok 3 Fast' },
      { id: 'grok-3-mini', name: 'Grok 3 Mini' },
      { id: 'grok-3-thinking', name: 'Grok 3 Thinking' },
      { id: 'grok-video', name: 'Grok Video' },
      { id: 'grok-video-1_1', name: 'Grok Video 1:1' },
      { id: 'grok-video-16_9', name: 'Grok Video 16:9' },
      { id: 'grok-video-2_3', name: 'Grok Video 2:3' },
      { id: 'grok-video-3_2', name: 'Grok Video 3:2' },
      { id: 'grok-video-9_16', name: 'Grok Video 9:16' },
      { id: 'grok-image', name: 'Grok Image' },
      { id: 'grok-image-1_1', name: 'Grok Image 1:1' },
      { id: 'grok-image-16_9', name: 'Grok Image 16:9' },
      { id: 'grok-image-2_3', name: 'Grok Image 2:3' },
      { id: 'grok-image-3_2', name: 'Grok Image 3:2' },
      { id: 'grok-image-9_16', name: 'Grok Image 9:16' },
      { id: 'grok-imagine-1.0-video', name: 'Grok Imagine 1.0 Video' },
      { id: 'grok-imagine-1.0-edit', name: 'Grok Imagine 1.0 Edit' },
      { id: 'grok-imagine-1.0', name: 'Grok Imagine 1.0' },
      { id: 'grok-imagine-0.9', name: 'Grok Imagine 0.9' },
      { id: 'grok-2', name: 'Grok 2' },
      { id: 'grok-2-mini', name: 'Grok 2 Mini' }
    ]
  },
  'local': {
    name: '🏠 本地部署',
    models: [
      { id: 'ollama', name: 'Ollama', badge: 'Local' },
      { id: 'lm-studio', name: 'LM Studio', badge: 'Local' },
      { id: 'vllm', name: 'vLLM', badge: 'Local' },
      { id: 'llamacpp', name: 'llama.cpp', badge: 'Local' }
    ]
  },
  'custom': {
    name: '🔧 自定义',
    models: [
      { id: 'custom', name: t('customModel') }
    ]
  }
};

// ── DOM ──
const messagesEl = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const historyList = document.getElementById('historyList');
const topbarTitle = document.getElementById('topbarTitle');
const overlay = document.getElementById('overlay');
const baseUrlInput = document.getElementById('baseUrlInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const systemPromptInput = document.getElementById('systemPromptInput');
const tempInput = document.getElementById('tempInput');
const tempVal = document.getElementById('tempVal');
const topPInput = document.getElementById('topPInput');
const topPVal = document.getElementById('topPVal');
const freqPenaltyInput = document.getElementById('freqPenaltyInput');
const freqPenaltyVal = document.getElementById('freqPenaltyVal');
const presPenaltyInput = document.getElementById('presPenaltyInput');
const presPenaltyVal = document.getElementById('presPenaltyVal');
const maxTokensInput = document.getElementById('maxTokensInput');
const contextLimitInput = document.getElementById('contextLimitInput');
const searchEngineSelect = document.getElementById('searchEngineSelect');
const searchApiKeyInput = document.getElementById('searchApiKeyInput');
const customSearchUrlInput = document.getElementById('customSearchUrlInput');
const customSearchUrlField = document.getElementById('customSearchUrlField');
const customSearchUrlInput2 = document.getElementById('customSearchUrlInput2');
const customSearchUrlField2 = document.getElementById('customSearchUrlField2');
const customSearchUrlInput3 = document.getElementById('customSearchUrlInput3');
const customSearchUrlField3 = document.getElementById('customSearchUrlField3');
const modelSelect = document.getElementById('modelSelect');
const customModelWrap = document.getElementById('customModelWrap');
const customModelInput = document.getElementById('customModelInput');
const apiStatus = document.getElementById('apiStatus');
const attachmentsEl = document.getElementById('attachments');
const draftContextWrap = document.getElementById('draftContextWrap');
const searchInput = document.getElementById('searchInput');
const streamToggle = document.getElementById('streamToggle');
const userAvatarInput = document.getElementById('userAvatarInput');
const aiAvatarInput = document.getElementById('aiAvatarInput');
const selMenuToggle = document.getElementById('selMenuToggle');
const selMenuButtons = document.getElementById('selMenuButtons');
const selMenuAsk = document.getElementById('selMenuAsk');
const selMenuRewrite = document.getElementById('selMenuRewrite');
const selMenuTranslate = document.getElementById('selMenuTranslate');
const selMenuSummarize = document.getElementById('selMenuSummarize');
const selMenuAnnotate = document.getElementById('selMenuAnnotate');
const selMenuCopy = document.getElementById('selMenuCopy');

selMenuToggle.addEventListener('change', () => {
  const disabled = !selMenuToggle.checked;
  [selMenuAsk, selMenuRewrite, selMenuTranslate, selMenuSummarize, selMenuAnnotate, selMenuCopy].forEach(cb => {
    cb.disabled = disabled;
    cb.closest('label').style.opacity = disabled ? '0.4' : '1';
  });
});

// Model selector elements
const modelBtn = document.getElementById('modelBtn');
const modelDropdown = document.getElementById('modelDropdown');
const modelCategories = document.getElementById('modelCategories');
const modelSearch = document.getElementById('modelSearch');
const currentModelSpan = document.getElementById('currentModel');

// Initialize profiles if not exists
if (!profiles.default) {
  profiles.default = { ...config };
}

// ── Model Selector ──
function renderModelCategories(filter = '', options = {}) {
  modelCategories.innerHTML = '';
  const filterLower = filter.toLowerCase();
  const currentModelId = currentModelSpan.dataset.modelId || modelSelect.value || config.model || 'gpt-4o';
  const expandCurrent = !!options.expandCurrent;
  const scrollToCurrent = !!options.scrollToCurrent;

  Object.entries(modelData).forEach(([key, category]) => {
    const filteredModels = category.models.filter(m =>
      m.name.toLowerCase().includes(filterLower) || m.id.toLowerCase().includes(filterLower)
    );

    if (filteredModels.length === 0) return;

    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'model-category';

    const header = document.createElement('div');
    const shouldExpand = filterLower
      ? true
      : (expandCurrent && filteredModels.some(model => model.id === currentModelId));
    header.className = 'model-category-header' + (shouldExpand ? '' : ' collapsed');
    header.innerHTML = `<span class="arrow">▼</span><span>${category.name}</span>`;

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'model-category-items' + (shouldExpand ? ' show' : '');

    filteredModels.forEach(model => {
      const item = document.createElement('div');
      item.className = 'model-item';
      if (currentModelId === model.id) item.classList.add('active');
      item.title = model.id; // Show ID on hover

      let html = `<span>${model.name}</span>`;
      if (model.badge) html += `<span class="model-badge">${model.badge}</span>`;
      item.innerHTML = html;

      item.addEventListener('click', () => {
        config.model = model.id;
        syncCurrentModelState(model.id, model.name);
        modelDropdown.classList.remove('show');

        // Show custom input if custom model
        if (model.id === 'custom') {
          customModelWrap.style.display = 'inline';
          customModelInput.focus();
        } else {
          customModelWrap.style.display = 'none';
        }

        updateStats();
        toast(t('switchedToModel').replace('{name}', model.name));
      });

      itemsDiv.appendChild(item);
    });

    header.addEventListener('click', () => {
      header.classList.toggle('collapsed');
      itemsDiv.classList.toggle('show');
    });

    categoryDiv.appendChild(header);
    categoryDiv.appendChild(itemsDiv);
    modelCategories.appendChild(categoryDiv);
  });

  if (scrollToCurrent) {
    const activeItem = modelCategories.querySelector('.model-item.active');
    if (activeItem) {
      requestAnimationFrame(() => {
        activeItem.scrollIntoView({ block: 'center' });
      });
    }
  }
}

// Toggle dropdown
modelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  modelDropdown.classList.toggle('show');
  if (modelDropdown.classList.contains('show')) {
    modelSearch.value = '';
    renderModelCategories('', { expandCurrent: true, scrollToCurrent: true });
    modelSearch.focus();
  }
});

// Search models
modelSearch.addEventListener('input', (e) => {
  const filter = e.target.value;
  renderModelCategories(filter, {
    expandCurrent: !filter,
    scrollToCurrent: !filter
  });
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!modelDropdown.contains(e.target) && e.target !== modelBtn) {
    modelDropdown.classList.remove('show');
  }
});

// Initialize current model display
function ensureModelSelectOption(modelId, modelName = modelId) {
  if (!modelId) return;
  let opt = modelSelect.querySelector(`option[value="${modelId}"]`);
  if (!opt) {
    opt = document.createElement('option');
    opt.value = modelId;
    opt.textContent = modelName;
    modelSelect.appendChild(opt);
  } else if (modelName) {
    opt.textContent = modelName;
  }
}

function syncCurrentModelState(modelId, modelName = modelId) {
  if (!modelId) return;
  currentModelSpan.dataset.modelId = modelId;
  currentModelSpan.textContent = modelName || modelId;
  ensureModelSelectOption(modelId, modelName || modelId);
  modelSelect.value = modelId;
}

function updateCurrentModelDisplay() {
  const modelId = config.model || 'gpt-4o';
  let modelName = modelId;

  Object.values(modelData).forEach(category => {
    const found = category.models.find(m => m.id === modelId);
    if (found) modelName = found.name;
  });

  syncCurrentModelState(modelId, modelName);
}

// ── Init ──
chrome.storage.local.get(['config', 'sessions', 'profiles', 'currentProfile', 'tokenUsage', 'currentId', 'currentPopupSessionId', 'pendingScreenshot'], (data) => {
  if (data.profiles) {
    profiles = data.profiles;
  } else {
    profiles = { default: { ...config } };
  }

  if (data.currentProfile) {
    currentProfile = data.currentProfile;
  } else {
    currentProfile = 'default';
  }

  // Load profile config
  if (profiles[currentProfile]) {
    config = { ...config, ...profiles[currentProfile] };
  } else if (data.config) {
    config = { ...config, ...data.config };
  }

  baseUrlInput.value = config.baseUrl || '';
  apiKeyInput.value = config.apiKey || '';
  systemPromptInput.value = config.systemPrompt || '';
  tempInput.value = config.temperature ?? 0.7;
  tempVal.textContent = tempInput.value;
  topPInput.value = config.topP ?? 1.0;
  topPVal.textContent = topPInput.value;
  freqPenaltyInput.value = config.frequencyPenalty ?? 0.0;
  freqPenaltyVal.textContent = freqPenaltyInput.value;
  presPenaltyInput.value = config.presencePenalty ?? 0.0;
  presPenaltyVal.textContent = presPenaltyInput.value;
  maxTokensInput.value = config.maxTokens || '';
  contextLimitInput.value = config.contextLimit || '';
  searchEngineSelect.value = config.searchEngine || 'tavily';
  searchApiKeyInput.value = config.searchApiKey || '';
  customSearchUrlInput.value = config.customSearchUrl || '';
  customSearchUrlInput2.value = config.customSearchUrl2 || '';
  customSearchUrlInput3.value = config.customSearchUrl3 || '';
  if (config.searchEngine === 'custom') {
    customSearchUrlField.style.display = 'block';
  } else if (config.searchEngine === 'custom2') {
    customSearchUrlField2.style.display = 'block';
  } else if (config.searchEngine === 'custom3') {
    customSearchUrlField3.style.display = 'block';
  }
  streamToggle.checked = config.streamEnabled ?? true;
  selMenuToggle.checked = config.selMenuEnabled ?? true;
  selMenuAsk.checked = config.selMenuAsk ?? true;
  selMenuRewrite.checked = config.selMenuRewrite ?? true;
  selMenuTranslate.checked = config.selMenuTranslate ?? true;
  selMenuSummarize.checked = config.selMenuSummarize ?? true;
  selMenuAnnotate.checked = config.selMenuAnnotate ?? true;
  selMenuCopy.checked = config.selMenuCopy ?? true;
  selMenuToggle.dispatchEvent(new Event('change'));
  userAvatarInput.value = config.userAvatar ? t('avatarUploaded') : '';
  aiAvatarInput.value = config.aiAvatar ? t('avatarUploaded') : '';

  // Update model display
  config.model = config.model || 'gpt-4o';
  updateCurrentModelDisplay();

  if (config.model === 'custom') {
    customModelWrap.style.display = 'inline';
    customModelInput.value = config.customModel || '';
  }

  if (data.sessions) { sessions = data.sessions; }
  currentId = initialSessionId || data.currentId || sessions[0]?.id || null;
  if (currentId && !sessions.find(s => s.id === currentId)) currentId = sessions[0]?.id || null;
  renderHistory();
  if (currentId) {
    loadSession(currentId, { syncStorage: false, forceRender: true });
  } else {
    renderMessages([]);
  }
  if (data.tokenUsage) { tokenUsage = data.tokenUsage; }

  // Load language preference - MUST be before updateUILanguage
  if (data.config && data.config.language) {
    currentLanguage = data.config.language;
  } else if (config.language) {
    currentLanguage = config.language;
  } else {
    currentLanguage = 'zh';
  }
  languageSelect.value = currentLanguage;

  updateApiStatus();
  updateStats();
  updateCurrentModelDisplay();
  updateUILanguage();
  if (!config.apiKey) overlay.classList.add('show');

  // Render profiles on init
  renderProfiles();
  renderProfilesModal();

  if (data.pendingScreenshot) {
    processPendingScreenshot(data.pendingScreenshot);
  }
});

// ── Web Search Toggle ──
const webSearchBtn = document.getElementById('webSearchBtn');
webSearchBtn.addEventListener('click', () => {
  webSearchEnabled = !webSearchEnabled;
  webSearchBtn.style.opacity = webSearchEnabled ? '1' : '0.4';
  webSearchBtn.style.color = webSearchEnabled ? '#10a37f' : '';
  webSearchBtn.title = webSearchEnabled ? t('webSearchOn') : t('webSearchOff');
  toast(webSearchEnabled ? '🌐 ' + t('webSearchOn') : t('webSearchOff'));
});

// ── Tavily Search ──
async function tavilySearch(query) {
  return EasyChatCore.executeSearch(query, config, {
    referenceSourceLabel: t('referenceSource'),
    searchResultsLabel: t('searchResults'),
    webSearchResult: t('searchResults'),
    noTitleLabel: t('noTitle')
  });
}

// ── Model ──
function getModel() {
  const currentModelId = currentModelSpan.dataset.modelId || modelSelect.value || config.model || '';
  if (currentModelId === 'custom') {
    return customModelInput.value.trim() || config.customModel || 'gpt-4o';
  }
  return currentModelId || 'gpt-4o';
}

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

function clipReasoningPreviewLine(text = '', maxLength = 34) {
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

// ── Temperature slider ──
tempInput.addEventListener('input', () => { tempVal.textContent = tempInput.value; });
topPInput.addEventListener('input', () => { topPVal.textContent = topPInput.value; });
freqPenaltyInput.addEventListener('input', () => { freqPenaltyVal.textContent = freqPenaltyInput.value; });
presPenaltyInput.addEventListener('input', () => { presPenaltyVal.textContent = presPenaltyInput.value; });

// ── Search engine selector ──
searchEngineSelect.addEventListener('change', () => {
  const v = searchEngineSelect.value;
  customSearchUrlField.style.display = v === 'custom' ? 'block' : 'none';
  customSearchUrlField2.style.display = v === 'custom2' ? 'block' : 'none';
  customSearchUrlField3.style.display = v === 'custom3' ? 'block' : 'none';
});

// ── Toast ──
function toast(msg, duration = 1800) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function getCurrentProfileName() {
  return currentProfile || 'default';
}

function getCurrentProfileText() {
  return `${t('currentProfileLabel')}: ${getCurrentProfileName()}`;
}

function updateCurrentProfileIndicators() {
  const statsProfile = document.getElementById('statsProfile');
  if (statsProfile) statsProfile.textContent = getCurrentProfileText();

  const welcomeProfile = document.getElementById('welcomeProfile');
  if (welcomeProfile) welcomeProfile.textContent = getCurrentProfileText();
}

function buildWelcomeMarkup() {
  return `<div class="welcome"><div class="welcome-icon">✦</div><h2>${t('welcomeTitle')}</h2><p>${t('welcomeDesc')}</p><div class="welcome-profile" id="welcomeProfile">${getCurrentProfileText()}</div><div class="shortcuts"><div class="shortcut"><kbd>Ctrl</kbd>+<kbd>N</kbd> ${t('shortcutNew')}</div><div class="shortcut"><kbd>Ctrl</kbd>+<kbd>/</kbd> ${t('shortcutFocus')}</div><div class="shortcut"><kbd>Ctrl</kbd>+<kbd>E</kbd> ${t('shortcutExport')}</div></div></div>`;
}

function buildSourceReferenceBlock(source) {
  const info = EasyChatCore.describeContextSource(source);
  const zh = currentLanguage === 'zh';
  return [
    zh ? `来源：${info.text}` : `Source: ${info.text}`,
    source?.title ? (zh ? `标题：${source.title}` : `Title: ${source.title}`) : '',
    source?.url ? (zh ? `链接：${source.url}` : `URL: ${source.url}`) : '',
    source?.preview ? (zh ? `摘录：${source.preview}` : `Excerpt: ${source.preview}`) : ''
  ].filter(Boolean).join('\n');
}

function createSourceFollowupContext(source) {
  const label = t('sourceAskLabel');
  const sourceBlock = buildSourceReferenceBlock(source);
  const zh = currentLanguage === 'zh';
  return {
    type: 'source_followup',
    icon: '💬',
    label,
    source,
    meta: {
      contextSources: [source]
    },
    promptFn: (userText) => zh
      ? `请优先基于以下来源回答用户问题。如果来源不足以支持结论，请明确标注为“推测”。${userText ? `\n\n用户问题：${userText}` : '\n\n如果用户没有补充问题，请先概括该来源要点，再说明它的关键信息。'}\n\n来源信息：\n${sourceBlock}`
      : `Answer the user's question primarily based on the source below. If the source is insufficient, explicitly mark that part as "Inference".${userText ? `\n\nUser Question: ${userText}` : '\n\nIf the user does not add a question, first summarize the source and then explain why it matters.'}\n\nSource:\n${sourceBlock}`
  };
}

function buildSourcesReferenceBlock(sources) {
  return EasyChatCore.dedupeContextSources(sources || [])
    .map((source, index) => `${index + 1}.\n${buildSourceReferenceBlock(source)}`)
    .join('\n\n');
}

function getSourcesFollowupLabel(count) {
  return currentLanguage === 'zh'
    ? `${t('sourcesAskLabel')}（${count}）`
    : `${t('sourcesAskLabel')} (${count})`;
}

function getSourcesFollowupReadyMessage(count) {
  return currentLanguage === 'zh'
    ? `已附加 ${count} 个来源`
    : `Attached ${count} sources to composer`;
}

function createSourcesFollowupContext(sources) {
  const dedupedSources = EasyChatCore.dedupeContextSources(sources || []);
  const count = dedupedSources.length;
  const label = getSourcesFollowupLabel(count);
  const sourceBlock = buildSourcesReferenceBlock(dedupedSources);
  const zh = currentLanguage === 'zh';
  return {
    type: 'sources_followup',
    icon: '🗂️',
    label,
    sources: dedupedSources,
    meta: {
      contextSources: dedupedSources
    },
    promptFn: (userText) => zh
      ? `请优先基于以下多个来源回答用户问题，并注意综合与对比它们。如果来源不足以支持结论，请明确标注为“推测”。${userText ? `\n\n用户问题：${userText}` : '\n\n如果用户没有补充问题，请先概括这些来源的共同要点，再说明其中的重要差异。'}\n\n来源信息：\n${sourceBlock}`
      : `Answer the user's question primarily based on the sources below. Combine and compare them carefully. If the sources are insufficient, explicitly mark that part as "Inference".${userText ? `\n\nUser Question: ${userText}` : '\n\nIf the user does not add a question, first summarize the key points shared across these sources, then note any important differences.'}\n\nSources:\n${sourceBlock}`
  };
}

function getUserComposerPlaceholder() {
  if (draftSourceContext?.type === 'source_followup') return t('sourceQuestionHint');
  if (draftSourceContext?.type === 'sources_followup') return t('sourcesQuestionHint');
  return t('placeholder');
}

function renderDraftContextTag() {
  draftContextWrap.innerHTML = '';
  if (!draftSourceContext) {
    draftContextWrap.style.display = 'none';
    userInput.placeholder = getUserComposerPlaceholder();
    return;
  }

  draftContextWrap.style.display = 'flex';
  const tag = document.createElement('div');
  tag.className = 'draft-context-tag';
  tag.innerHTML = `${draftSourceContext.icon} ${draftSourceContext.label}`;

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'draft-context-remove';
  rm.textContent = '×';
  rm.addEventListener('click', () => {
    draftSourceContext = null;
    renderDraftContextTag();
    userInput.focus();
  });

  tag.appendChild(rm);
  draftContextWrap.appendChild(tag);
  userInput.placeholder = getUserComposerPlaceholder();
}

function attachSourceFollowupContext(source) {
  draftSourceContext = createSourceFollowupContext(source);
  renderDraftContextTag();
  userInput.focus();
  toast(t('sourceAskReady'));
}

function attachSourcesFollowupContext(sources) {
  const dedupedSources = EasyChatCore.dedupeContextSources(sources || []);
  if (!dedupedSources.length) return;
  draftSourceContext = createSourcesFollowupContext(dedupedSources);
  renderDraftContextTag();
  userInput.focus();
  toast(getSourcesFollowupReadyMessage(dedupedSources.length));
}

// ── Stats ──
function updateStats() {
  const s = current();
  const msgs = s ? s.messages.length : 0;
  const chars = s ? s.messages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0) : 0;
  document.getElementById('statsMsgs').textContent = `${t('messages')}: ${msgs}`;
  document.getElementById('statsChars').textContent = `${t('characters')}: ${chars}`;
  updateCurrentProfileIndicators();
  document.getElementById('statsModel').textContent = getModel();
}

// ── Settings ──
document.getElementById('settingsBtn').addEventListener('click', () => overlay.classList.add('show'));
document.getElementById('cancelBtn').addEventListener('click', () => overlay.classList.remove('show'));

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-content[data-tab="${tab}"]`).classList.add('active');

    // Render token stats when switching to data tab
    if (tab === 'data') {
      renderTokenUsageStats();
    }
  });
});

document.getElementById('saveBtn').addEventListener('click', () => {
  config.baseUrl = baseUrlInput.value.trim().replace(/\/$/, '');
  config.apiKey = apiKeyInput.value.trim();
  config.systemPrompt = systemPromptInput.value.trim();
  config.temperature = parseFloat(tempInput.value);
  config.topP = parseFloat(topPInput.value);
  config.frequencyPenalty = parseFloat(freqPenaltyInput.value);
  config.presencePenalty = parseFloat(presPenaltyInput.value);
  config.maxTokens = maxTokensInput.value ? parseInt(maxTokensInput.value) : '';
  config.contextLimit = contextLimitInput.value ? parseInt(contextLimitInput.value) : '';
  config.searchEngine = searchEngineSelect.value;
  config.searchApiKey = searchApiKeyInput.value.trim();
  config.customSearchUrl = customSearchUrlInput.value.trim();
  config.customSearchUrl2 = customSearchUrlInput2.value.trim();
  config.customSearchUrl3 = customSearchUrlInput3.value.trim();
  config.streamEnabled = streamToggle.checked;
  config.selMenuEnabled = selMenuToggle.checked;
  config.selMenuAsk = selMenuAsk.checked;
  config.selMenuRewrite = selMenuRewrite.checked;
  config.selMenuTranslate = selMenuTranslate.checked;
  config.selMenuSummarize = selMenuSummarize.checked;
  config.selMenuAnnotate = selMenuAnnotate.checked;
  config.selMenuCopy = selMenuCopy.checked;
  config.model = getModel();

  // Save to current profile
  profiles[currentProfile] = { ...config };
  chrome.storage.local.set({ config, profiles, currentProfile });
  overlay.classList.remove('show');
  updateApiStatus();
  toast(t('settingsSaved'));
});
function updateApiStatus() {
  apiStatus.className = 'api-status' + (config.apiKey ? ' ok' : '');
}

// ── Test connection ──
document.getElementById('testBtn').addEventListener('click', async () => {
  const testBtn = document.getElementById('testBtn');
  const baseUrl = EasyChatCore.normalizeBaseUrl(baseUrlInput.value.trim());
  const apiKey = apiKeyInput.value.trim();
  const model = getModel();
  if (!apiKey) { showTestResult('error', t('pleaseEnterApiKey')); return; }
  testBtn.disabled = true; testBtn.textContent = t('testing');
  showTestResult('info', t('connecting'));
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5, stream: false })
    });
    const json = await res.json().catch(() => null);
    if (res.ok) showTestResult('ok', t('connectionOk').replace('{reply}', json?.choices?.[0]?.message?.content || '').replace('{url}', baseUrl));
    else showTestResult('error', t('connectionFailed').replace('{msg}', json?.error?.message || 'HTTP ' + res.status).replace('{url}', baseUrl));
  } catch (err) {
    showTestResult('error', t('networkError').replace('{msg}', err.message).replace('{url}', baseUrl));
  } finally { testBtn.disabled = false; testBtn.textContent = t('testConnection'); }
});
function showTestResult(type, msg) {
  const el = document.getElementById('testResult');
  el.style.display = 'block'; el.textContent = msg;
  const s = { ok: ['#0d2e1f','#10a37f','#4ade80'], error: ['#2e0d0d','#6b2a2a','#f87171'], info: ['#1e1e2e','#444','#aaa'] }[type];
  el.style.background = s[0]; el.style.border = `1px solid ${s[1]}`; el.style.color = s[2];
}

// ── Topbar actions ──
document.getElementById('openSidebarBtn').addEventListener('click', () => {
  openSidebar();
});
document.getElementById('refreshBtn').addEventListener('click', () => location.reload());
document.getElementById('clearBtn').addEventListener('click', () => {
  if (!currentId) return;
  const s = current();
  if (!s?.messages.length) return;
  if (!confirm(t('confirmClearChat'))) return;
  s.messages = []; save(); renderMessages([]); updateStats(); toast(t('chatCleared'));
});
document.getElementById('exportBtn').addEventListener('click', exportChat);
function exportChat() {
  const s = current();
  if (!s?.messages.length) { toast(t('noContentToExport')); return; }
  const lines = s.messages.map(m => {
    const role = m.role === 'user' ? t('exportUser') : t('exportAI');
    const text = getPlainText(m.content);
    return `## ${role}\n\n${text}`;
  });
  const md = `# ${s.title}\n\n` + lines.join('\n\n---\n\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${s.title}.md`; a.click();
  URL.revokeObjectURL(url); toast(t('exportedMarkdown'));
}

// ── Search ──
searchInput.addEventListener('input', () => renderHistory(searchInput.value.trim()));

// ── File / Image upload ──
document.getElementById('imgBtn').addEventListener('click', () => document.getElementById('imgInput').click());
document.getElementById('fileBtn').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('imgInput').addEventListener('change', (e) => { [...e.target.files].forEach(readImage); e.target.value = ''; });
document.getElementById('fileInput').addEventListener('change', (e) => { [...e.target.files].forEach(readFile); e.target.value = ''; });

function readImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    attachments.push({ type: 'image', name: file.name, dataUrl, base64: dataUrl.split(',')[1], mimeType: file.type });
    renderAttachments();
  };
  reader.readAsDataURL(file);
}
function processPendingScreenshot(ps) {
  if (!ps) return;
  const dataUrl = typeof ps === 'string' ? ps : (ps.full || null);
  if (!dataUrl) return;
  attachments.push({
    type: 'image', name: 'screenshot.png',
    dataUrl, base64: dataUrl.split(',')[1] || '', mimeType: 'image/png'
  });
  renderAttachments();
}
function readFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => { attachments.push({ type: 'file', name: file.name, text: e.target.result }); renderAttachments(); };
  reader.readAsText(file);
}
function renderAttachments() {
  attachmentsEl.innerHTML = '';
  attachments.forEach((a, i) => {
    const item = document.createElement('div');
    const rm = document.createElement('button');
    rm.className = 'remove-attach'; rm.textContent = '✕';
    rm.addEventListener('click', () => {
      if (a.name === 'screenshot.png') chrome.storage.local.remove('pendingScreenshot');
      attachments.splice(i, 1); renderAttachments();
    });
    if (a.type === 'image') {
      item.className = 'attach-item';
      const img = document.createElement('img'); img.src = a.dataUrl;
      item.appendChild(img); item.appendChild(rm);
    } else {
      item.className = 'attach-item file-item';
      item.innerHTML = `<span>📄</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">${a.name}</span>`;
      item.appendChild(rm);
    }
    attachmentsEl.appendChild(item);
  });
}
document.addEventListener('paste', (e) => {
  for (const item of (e.clipboardData?.items || [])) {
    if (item.type.startsWith('image/')) readImage(item.getAsFile());
  }
});

// ── Auto scroll ──
messagesEl.addEventListener('scroll', () => {
  const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
  autoScroll = atBottom;
});
function scrollBottom() { if (autoScroll) messagesEl.scrollTop = messagesEl.scrollHeight; }

// ── Input ──
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
});
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
sendBtn.addEventListener('click', send);
document.getElementById('newChatBtn').addEventListener('click', newChat);

// Language selector
const languageSelect = document.getElementById('languageSelect');
languageSelect.addEventListener('change', () => {
  currentLanguage = languageSelect.value;
  config.language = currentLanguage;
  chrome.storage.local.set({ config });
  updateUILanguage();
});

function updateUILanguage() {
  // Update topbar
  document.getElementById('openSidebarBtn').textContent = t('sidebarBtn');
  document.getElementById('exportBtn').textContent = t('export');
  document.getElementById('clearBtn').textContent = t('clear');
  document.getElementById('newChatBtn').textContent = '+ ' + t('newChat');

  // Update web search button
  const webSearchBtn = document.getElementById('webSearchBtn');
  webSearchBtn.title = webSearchEnabled ? t('webSearchOn') : t('webSearchOff');

  // Update input
  userInput.placeholder = getUserComposerPlaceholder();
  document.querySelector('.input-hint').textContent = t('inputHint');

  // Update model search
  document.getElementById('modelSearch').placeholder = t('searchPlaceholder');

  // Update welcome screen if visible
  const welcome = document.querySelector('.welcome h2');
  if (welcome) welcome.textContent = t('welcomeTitle');
  const welcomeDesc = document.querySelector('.welcome p');
  if (welcomeDesc) welcomeDesc.textContent = t('welcomeDesc');
  updateCurrentProfileIndicators();

  // Update shortcuts
  const shortcuts = document.querySelectorAll('.welcome .shortcut');
  if (shortcuts.length >= 3) {
    shortcuts[0].innerHTML = `<kbd>Ctrl</kbd>+<kbd>N</kbd> ${t('shortcutNew')}`;
    shortcuts[1].innerHTML = `<kbd>Ctrl</kbd>+<kbd>/</kbd> ${t('shortcutFocus')}`;
    shortcuts[2].innerHTML = `<kbd>Ctrl</kbd>+<kbd>E</kbd> ${t('shortcutExport')}`;
  }

  // Update sidebar
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.textContent = t('settings');

  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) clearAllBtn.textContent = t('clearAllConversations');

  // Update modal title
  if (modalTitle) modalTitle.textContent = t('settings');

  // Update modal tabs
  const tabs = document.querySelectorAll('.tab-btn');
  if (tabs.length >= 5) {
    tabs[0].textContent = t('apiConfig');
    tabs[1].textContent = t('aiParams');
    tabs[2].textContent = t('interfaceSettings');
    tabs[3].textContent = t('profilesManagement');
    tabs[4].textContent = t('dataManagement');
  }

  // Update modal buttons
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.textContent = t('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.textContent = t('cancelBtn');
  const testBtn = document.getElementById('testBtn');
  if (testBtn) testBtn.textContent = t('testConnection');

  // Update confirm dialog buttons
  const confirmNo = document.getElementById('confirmNo');
  if (confirmNo) confirmNo.textContent = t('confirmCancel');
  const confirmYes = document.getElementById('confirmYes');
  if (confirmYes) confirmYes.textContent = t('confirmDelete');

  // Update profile modal
  const profilesTitle = document.querySelector('#profilesOverlay > div > div:first-child');
  if (profilesTitle) profilesTitle.textContent = t('profilesTitle');

  const newProfileInput = document.getElementById('newProfileName');
  if (newProfileInput) newProfileInput.placeholder = t('newProfilePlaceholder');

  const newProfileInputModal = document.getElementById('newProfileNameModal');
  if (newProfileInputModal) newProfileInputModal.placeholder = t('newProfilePlaceholder');

  const createProfileBtn = document.getElementById('createProfileBtn');
  if (createProfileBtn) createProfileBtn.textContent = t('createBtn');

  const createProfileBtnModal = document.getElementById('createProfileBtnModal');
  if (createProfileBtnModal) createProfileBtnModal.textContent = t('createBtn');

  const closeProfilesBtn = document.getElementById('closeProfilesBtn');
  if (closeProfilesBtn) closeProfilesBtn.textContent = t('closeBtn');

  // Update upload buttons
  const uploadUserAvatar = document.getElementById('uploadUserAvatar');
  if (uploadUserAvatar) uploadUserAvatar.textContent = t('uploadBtn');

  const uploadAiAvatar = document.getElementById('uploadAiAvatar');
  if (uploadAiAvatar) uploadAiAvatar.textContent = t('uploadBtn');

  const clearUserAvatar = document.getElementById('clearUserAvatar');
  if (clearUserAvatar) clearUserAvatar.textContent = t('clearBtn');

  const clearAiAvatar = document.getElementById('clearAiAvatar');
  if (clearAiAvatar) clearAiAvatar.textContent = t('clearBtn');

  // Update attach button titles
  const imgBtn = document.getElementById('imgBtn');
  if (imgBtn) imgBtn.title = t('uploadImageTitle');

  const fileBtn = document.getElementById('fileBtn');
  if (fileBtn) fileBtn.title = t('uploadFileTitle');

  // Update current title if it's default
  if (topbarTitle.textContent === '新对话' || topbarTitle.textContent === 'New Chat' || topbarTitle.textContent === 'EasyChat') {
    topbarTitle.textContent = 'EasyChat';
  }

  // Re-render profiles to update button text
  renderProfiles();
  renderProfilesModal();

  // Re-render history to update delete button titles
  renderHistory();

  // Update search input placeholder
  if (searchInput) searchInput.placeholder = t('searchConversations');

  // Update stats labels
  const statsMsgs = document.getElementById('statsMsgs');
  const statsChars = document.getElementById('statsChars');
  if (statsMsgs && statsChars) {
    const msgsCount = statsMsgs.textContent.match(/\d+/)?.[0] || '0';
    const charsCount = statsChars.textContent.match(/\d+/)?.[0] || '0';
    statsMsgs.textContent = `${t('messages')}: ${msgsCount}`;
    statsChars.textContent = `${t('characters')}: ${charsCount}`;
  }

  // Update stop button title
  if (stopBtn) stopBtn.title = t('stopGeneration');

  // Fix hardcoded placeholders/titles in HTML that aren't covered above
  systemPromptInput.placeholder = t('systemPromptPlaceholder');
  maxTokensInput.placeholder = t('maxTokensPlaceholder');
  contextLimitInput.placeholder = t('contextLimitPlaceholder');
  if (!userAvatarInput.value) userAvatarInput.placeholder = currentLanguage === 'zh' ? '留空使用默认' : 'Leave empty for default';
  if (!aiAvatarInput.value) aiAvatarInput.placeholder = currentLanguage === 'zh' ? '留空使用默认' : 'Leave empty for default';
  if (draftSourceContext?.type === 'source_followup' && draftSourceContext.source) {
    draftSourceContext = createSourceFollowupContext(draftSourceContext.source);
    renderDraftContextTag();
  } else if (draftSourceContext?.type === 'sources_followup' && draftSourceContext.sources?.length) {
    draftSourceContext = createSourcesFollowupContext(draftSourceContext.sources);
    renderDraftContextTag();
  }

  const newProfileName = document.getElementById('newProfileName');
  if (newProfileName) newProfileName.placeholder = t('newProfilePlaceholder');
  const newProfileNameModal = document.getElementById('newProfileNameModal');
  if (newProfileNameModal) newProfileNameModal.placeholder = t('newProfilePlaceholder');

  // Params tab labels & hints (hardcoded in HTML)
  const zh = currentLanguage === 'zh';

  const setLabelText = (el, text) => {
    if (!el) return;
    // label may contain a child span (for the value display), preserve it
    const span = el.querySelector('span');
    el.childNodes[0].textContent = text + (span ? '' : '');
    if (span) el.insertBefore(document.createTextNode(text), span);
    // remove duplicate text nodes
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3);
    if (nodes.length > 1) nodes.slice(0, -1).forEach(n => n.remove());
  };

  const setFirstText = (el, text) => {
    if (!el) return;
    const first = [...el.childNodes].find(n => n.nodeType === 3);
    if (first) first.textContent = text;
    else el.insertBefore(document.createTextNode(text), el.firstChild);
  };

  setFirstText(systemPromptInput.closest('.field')?.querySelector('label'),
    zh ? 'System Prompt（AI 角色设定）' : 'System Prompt (AI Role)');

  const tempLabel = tempInput.closest('.field')?.querySelector('label');
  setFirstText(tempLabel, zh ? 'Temperature（创造性）' : 'Temperature (Creativity)');
  const tempHint = tempInput.closest('.field')?.querySelector('.hint');
  if (tempHint) tempHint.textContent = zh ? '0 = 精确稳定，2 = 更有创意' : '0 = Precise & Stable, 2 = More Creative';

  const topPLabel = topPInput.closest('.field')?.querySelector('label');
  setFirstText(topPLabel, zh ? 'Top P（采样范围）' : 'Top P (Sampling Range)');
  const topPHint = topPInput.closest('.field')?.querySelector('.hint');
  if (topPHint) topPHint.textContent = zh ? '控制生成文本的多样性，0.1 = 保守，1.0 = 多样' : 'Controls text diversity, 0.1 = Conservative, 1.0 = Diverse';

  const freqLabel = freqPenaltyInput.closest('.field')?.querySelector('label');
  setFirstText(freqLabel, zh ? 'Frequency Penalty（频率惩罚）' : 'Frequency Penalty');
  const freqHint = freqPenaltyInput.closest('.field')?.querySelector('.hint');
  if (freqHint) freqHint.textContent = zh ? '降低重复词汇的概率，-2 到 2' : 'Reduce repetition, -2 to 2';

  const presLabel = presPenaltyInput.closest('.field')?.querySelector('label');
  setFirstText(presLabel, zh ? 'Presence Penalty（存在惩罚）' : 'Presence Penalty');
  const presHint = presPenaltyInput.closest('.field')?.querySelector('.hint');
  if (presHint) presHint.textContent = zh ? '鼓励谈论新话题，-2 到 2' : 'Encourage new topics, -2 to 2';

  const maxTokensLabel = maxTokensInput.closest('.field')?.querySelector('label');
  if (maxTokensLabel) maxTokensLabel.textContent = zh ? '最大 Token' : 'Max Tokens';

  const contextLimitLabel = contextLimitInput.closest('.field')?.querySelector('label');
  setFirstText(contextLimitLabel, zh ? '上下文消息数' : 'Context Messages');
  const contextLimitHint = contextLimitInput.closest('.field')?.querySelector('.hint');
  if (contextLimitHint) contextLimitHint.textContent = t('contextLimitHint');

  // Search engine hints
  const searchEngineHint = searchEngineSelect.closest('.field')?.querySelector('.hint');
  if (searchEngineHint) searchEngineHint.textContent = zh ? '选择联网搜索引擎' : 'Select search engine for web search';
  const searchEngineLabel = searchEngineSelect.closest('.field')?.querySelector('label');
  if (searchEngineLabel) searchEngineLabel.textContent = zh ? '联网搜索引擎' : 'Web Search Engine';

  const searchApiKeyLabel = searchApiKeyInput.closest('.field')?.querySelector('label');
  if (searchApiKeyLabel) searchApiKeyLabel.textContent = zh ? '搜索 API Key' : 'Search API Key';
  const searchApiKeyHint = searchApiKeyInput.closest('.field')?.querySelector('.hint');
  if (searchApiKeyHint) searchApiKeyHint.textContent = zh ? '填写所选搜索引擎的 API Key' : 'Fill in API Key for selected search engine';

  const customSearchUrlLabel = customSearchUrlInput.closest('.field')?.querySelector('label');
  if (customSearchUrlLabel) customSearchUrlLabel.textContent = zh ? '自定义搜索 API URL' : 'Custom Search API URL';
  const customSearchUrlHint = customSearchUrlInput.closest('.field')?.querySelector('.hint');
  if (customSearchUrlHint) customSearchUrlHint.textContent = zh ? '使用 {query} 作为搜索关键词占位符' : 'Use {query} as search keyword placeholder';

  // Interface tab
  const streamHint = streamToggle.closest('.field')?.querySelector('.hint');
  if (streamHint) streamHint.textContent = zh ? '实时显示 AI 回复，边生成边渲染 Markdown' : 'Real-time display of AI replies, render Markdown as generated';
  const streamLabel = streamToggle.closest('label')?.querySelector('span');
  if (streamLabel) streamLabel.textContent = zh ? '启用流式输出' : 'Enable Streaming';

  const userAvatarLabel = userAvatarInput.closest('.field')?.querySelector('label');
  if (userAvatarLabel) userAvatarLabel.textContent = zh ? '用户头像' : 'User Avatar';
  const userAvatarHint = userAvatarInput.closest('.field')?.querySelector('.hint');
  if (userAvatarHint) userAvatarHint.textContent = zh ? '上传本地图片作为用户头像' : 'Upload local image as user avatar';

  const aiAvatarLabel = aiAvatarInput.closest('.field')?.querySelector('label');
  if (aiAvatarLabel) aiAvatarLabel.textContent = zh ? 'AI 头像' : 'AI Avatar';
  const aiAvatarHint = aiAvatarInput.closest('.field')?.querySelector('.hint');
  if (aiAvatarHint) aiAvatarHint.textContent = zh ? '上传本地图片作为 AI 头像' : 'Upload local image as AI avatar';

  // Buttons
  const clearTokenUsageBtn = document.getElementById('clearTokenUsageBtn');
  if (clearTokenUsageBtn) clearTokenUsageBtn.textContent = zh ? '清除 Token 统计' : 'Clear Token Statistics';
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');
  if (clearAllDataBtn) clearAllDataBtn.textContent = zh ? '🗑️ 清除所有数据' : '🗑️ Clear All Data';

  // Data tab labels
  const tokenStatsLabel = document.querySelector('#tokenUsageStats')?.closest('.field')?.querySelector('label');
  if (tokenStatsLabel) tokenStatsLabel.textContent = zh ? '📊 Token 使用统计' : '📊 Token Usage Statistics';
  const dangerLabel = document.querySelector('#clearAllDataBtn')?.closest('.field')?.querySelector('label');
  if (dangerLabel) dangerLabel.textContent = zh ? '⚠️ 危险区域' : '⚠️ Danger Zone';
  const dangerHint = document.querySelector('#clearAllDataBtn')?.closest('.field')?.querySelector('.hint');
  if (dangerHint) dangerHint.textContent = zh ? '以下操作不可撤销' : 'The following operations cannot be undone';
  const clearAllDataHint = document.querySelector('#clearAllDataBtn + .hint') || document.querySelector('.hint[style*="f87171"]');
  if (clearAllDataHint) clearAllDataHint.textContent = zh ? '此操作将清除所有对话、配置、头像等数据' : 'This will clear all conversations, configs, avatars and data';

  // API tab hints
  const baseUrlHint = baseUrlInput.closest('.field')?.querySelector('.hint');
  if (baseUrlHint) baseUrlHint.textContent = t('baseUrlHint');
  const apiKeyLabel = apiKeyInput.closest('.field')?.querySelector('label');
  if (apiKeyLabel) apiKeyLabel.textContent = 'API Key';

  // Selection menu settings labels
  const selMenuLabel = selMenuToggle?.closest('label')?.querySelector('span');
  if (selMenuLabel) selMenuLabel.textContent = zh ? '选中菜单' : 'Selection Menu';
  const selMenuLabels = [
    [selMenuAsk, zh ? '问 AI' : 'Ask AI'],
    [selMenuRewrite, zh ? '改写' : 'Rewrite'],
    [selMenuTranslate, zh ? '翻译' : 'Translate'],
    [selMenuSummarize, zh ? '总结' : 'Summarize'],
    [selMenuAnnotate, zh ? '标注' : 'Annotate'],
    [selMenuCopy, zh ? '复制' : 'Copy']
  ];
  selMenuLabels.forEach(([el, text]) => {
    if (!el?.parentNode) return;
    const label = el.parentNode;
    const textNode = [...label.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (textNode) textNode.textContent = ' ' + text;
  });

  // Custom model placeholder
  if (customModelInput) customModelInput.placeholder = zh ? '模型名称' : 'Model name';

  // Custom search URL labels
  const searchSelect = document.getElementById('searchEngineSelect') || searchEngineSelect;
  if (searchSelect) {
    const opt2 = searchSelect.querySelector('option[value="custom2"]');
    if (opt2) opt2.textContent = zh ? '自定义 2' : 'Custom 2';
    const opt3 = searchSelect.querySelector('option[value="custom3"]');
    if (opt3) opt3.textContent = zh ? '自定义 3' : 'Custom 3';
  }
  document.querySelectorAll('.field label').forEach(label => {
    if (label.textContent.trim() === '自定义 2 API URL' || label.textContent.trim() === 'Custom 2 API URL')
      label.textContent = zh ? '自定义 2 API URL' : 'Custom 2 API URL';
    if (label.textContent.trim() === '自定义 3 API URL' || label.textContent.trim() === 'Custom 3 API URL')
      label.textContent = zh ? '自定义 3 API URL' : 'Custom 3 API URL';
  });
}

// Stop generation
stopBtn.addEventListener('click', () => {
  if (abortController) { abortController.abort(); abortController = null; }
});

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newChat(); }
  if (e.ctrlKey && e.key === '/') { e.preventDefault(); userInput.focus(); }
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportChat(); }
});

// ── Sessions ──
function newChat() {
  const id = Date.now().toString();
  sessions.unshift({ id, title: t('newChat'), messages: [], createdAt: Date.now() });
  currentId = id; save(); renderHistory(); renderMessages([]);
  topbarTitle.textContent = t('newChat'); updateStats();
  restoreBackgroundStreamForCurrentSession().catch(() => {});
}
function loadSession(id, options = {}) {
  const s = sessions.find(s => s.id === id);
  if (!s) return;
  const sameSession = currentId === id;
  currentId = id;
  if (options.syncStorage !== false) saveCurrentId();
  if (options.rerenderHistory) renderHistory();
  else updateHistoryActiveState();
  if (sameSession && !options.forceRender) {
    restoreBackgroundStreamForCurrentSession().catch(() => {});
    return;
  }
  topbarTitle.textContent = s.title;
  renderMessages(s.messages); updateStats();
  restoreBackgroundStreamForCurrentSession().catch(() => {});
}
function deleteSession(id) {
  confirm2(t('deleteConversation'), () => {
    sessions = sessions.filter(s => s.id !== id);
    if (currentId === id) { currentId = null; renderMessages([]); topbarTitle.textContent = t('newChat'); }
    save(); renderHistory(); updateStats(); toast(t('conversationDeleted'));
  });
}
function renameSession(id) {
  const s = sessions.find(s => s.id === id);
  if (!s) return;
  const item = historyList.querySelector(`[data-id="${id}"] .h-title`);
  if (!item) return;
  const input = document.createElement('input');
  input.className = 'rename-input'; input.value = s.title;
  item.replaceWith(input); input.focus(); input.select();
  const commit = () => {
    const val = input.value.trim() || s.title;
    s.title = val; save(); renderHistory();
    if (currentId === id) topbarTitle.textContent = val;
    toast(t('renamed'));
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } if (e.key === 'Escape') renderHistory(); });
}
function current() { return sessions.find(s => s.id === currentId); }
function save() { chrome.storage.local.set({ sessions, tokenUsage, currentId }); }
function saveCurrentId() { chrome.storage.local.set({ currentId }); }
function updateHistoryActiveState() {
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === currentId);
  });
}

let proxyStreaming = false; // true while handling a PROXY_SEND request
let backgroundSyncBubble = null;
let backgroundSyncSessionId = null;

function setBackgroundStreamControls(sessionId) {
  backgroundSyncSessionId = sessionId || null;
  if (sessionId) {
    streaming = true;
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

function clearBackgroundSyncUi() {
  backgroundSyncBubble = null;
  backgroundSyncSessionId = null;
  removeTyping();
}

function ensureBackgroundSyncBubble() {
  if (backgroundSyncBubble && backgroundSyncSessionId === currentId) return backgroundSyncBubble;
  removeTyping();
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  wrap.appendChild(bubble);
  row.appendChild(createAiAvatarElement());
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  backgroundSyncBubble = bubble;
  backgroundSyncSessionId = currentId;
  scrollBottom();
  return bubble;
}

async function restoreBackgroundStreamForCurrentSession() {
  if (!currentId || proxyStreaming || (streaming && abortController?.type !== 'background')) return;
  const res = await bgMessage({ type: 'GET_ACTIVE_STREAM', sessionId: currentId }).catch(() => null);
  const stream = res?.stream;
  if (!stream) {
    if (backgroundSyncSessionId === currentId) clearBackgroundSyncUi();
    if (!proxyStreaming) setBackgroundStreamControls(null);
    return;
  }

  setBackgroundStreamControls(currentId);
  const visibleText = extractStreamableAnswerText(stream.rawFull, stream.model).trim();
  if (!visibleText) {
    showReasoningPreview(stream.rawFull, stream.model);
    return;
  }

  const bubble = ensureBackgroundSyncBubble();
  const rendered = renderMarkdown(visibleText, { useCache: false, bind: false });
  if (rendered) {
    applyRenderedMarkdown(bubble, rendered);
  } else {
    bubble.className = 'bubble';
    bubble.textContent = visibleText;
  }
  scrollBottom();
}

// ── Cross-window sync ──
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.pendingScreenshot?.newValue) {
    processPendingScreenshot(changes.pendingScreenshot.newValue);
  }
  if (changes.currentId?.newValue && changes.currentId.newValue !== currentId && !streaming && !proxyStreaming) {
    const nextId = changes.currentId.newValue;
    if (sessions.find(s => s.id === nextId)) {
      loadSession(nextId, { syncStorage: false });
      return;
    }
  }
  if (streaming || proxyStreaming) return;
  if (!changes.sessions) return;
  const newSessions = changes.sessions.newValue || [];
  const oldCount = (current()?.messages || []).length;
  sessions = newSessions;
  renderHistory();
  const s = current();
  if (!s) return;
  const newCount = s.messages.length;
  if (backgroundSyncBubble && backgroundSyncSessionId === currentId && newCount > oldCount) {
    renderMessages(s.messages);
    clearBackgroundSyncUi();
    setBackgroundStreamControls(null);
    return;
  }
  if (newCount > oldCount) {
    for (let i = oldCount; i < newCount; i++) {
      addBubbleFromMsg(s.messages[i], i);
    }
    scrollBottom();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'STREAM_CHUNK' && msg.type !== 'STREAM_DONE' && msg.type !== 'STREAM_ERROR') return;
  if (msg.sessionId !== currentId) return;
  if (proxyStreaming || (streaming && abortController?.type !== 'background')) return;

  if (msg.type === 'STREAM_CHUNK') {
    setBackgroundStreamControls(msg.sessionId);
    const visibleText = extractStreamableAnswerText(msg.rawFull, msg.model).trim();
    if (!visibleText) {
      showReasoningPreview(msg.rawFull, msg.model);
      return;
    }

    const bubble = ensureBackgroundSyncBubble();
    const rendered = renderMarkdown(visibleText, { useCache: false, bind: false });
    if (rendered) {
      applyRenderedMarkdown(bubble, rendered);
    } else {
      bubble.className = 'bubble';
      bubble.textContent = visibleText;
    }
    scrollBottom();
    return;
  }

  if (msg.type === 'STREAM_DONE') {
    chrome.storage.local.get(['sessions'], (data) => {
      if (data.sessions) sessions = data.sessions;
      renderHistory();
      const updated = sessions.find(s => s.id === currentId);
      if (updated) {
        topbarTitle.textContent = updated.title || t('newChat');
        renderMessages(updated.messages);
      }
      clearBackgroundSyncUi();
      setBackgroundStreamControls(null);
    });
    return;
  }

  clearBackgroundSyncUi();
  setBackgroundStreamControls(null);
  if (!msg.stopped) {
    addErrorBubble(msg.error || t('requestFailed'));
  } else {
    toast(t('generationStopped'));
  }
});

// ── Token Usage Tracking ──
function recordTokenUsage(model, usage) {
  if (!tokenUsage[model]) {
    tokenUsage[model] = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  }
  tokenUsage[model].prompt_tokens += usage.prompt_tokens || 0;
  tokenUsage[model].completion_tokens += usage.completion_tokens || 0;
  tokenUsage[model].total_tokens += usage.total_tokens || 0;
  chrome.storage.local.set({ tokenUsage });
}

function renderHistory(filter = '') {
  historyList.innerHTML = '';
  const list = filter ? sessions.filter(s => s.title.toLowerCase().includes(filter.toLowerCase())) : sessions;
  const fragment = document.createDocumentFragment();
  list.forEach(s => {
    const div = document.createElement('div');
    div.className = 'history-item' + (s.id === currentId ? ' active' : '');
    div.dataset.id = s.id;
    const title = document.createElement('span');
    title.className = 'h-title'; title.textContent = s.title;
    title.addEventListener('click', () => loadSession(s.id));
    const actions = document.createElement('div'); actions.className = 'h-actions';
    const renameBtn = document.createElement('button');
    renameBtn.className = 'h-btn'; renameBtn.textContent = '✏'; renameBtn.title = t('renameBtn');
    renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renameSession(s.id); });
    const delBtn = document.createElement('button');
    delBtn.className = 'h-btn danger'; delBtn.textContent = '🗑'; delBtn.title = t('deleteBtn');
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteSession(s.id); });
    actions.appendChild(renameBtn); actions.appendChild(delBtn);
    div.appendChild(title); div.appendChild(actions);
    fragment.appendChild(div);
  });
  historyList.appendChild(fragment);
}

// ── Markdown ──
function getMarkdownRenderCacheKey(text) {
  return `${currentLanguage}\u0000${String(text || '')}`;
}

function trimMarkdownRenderCache() {
  while (markdownRenderCache.size > MARKDOWN_RENDER_CACHE_LIMIT) {
    const oldestKey = markdownRenderCache.keys().next().value;
    if (oldestKey === undefined) break;
    markdownRenderCache.delete(oldestKey);
  }
}

function bindMarkdownInteractions(root) {
  if (!root) return;
  root.querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
  root.querySelectorAll('.code-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.code-wrap');
      const code = wrap?.querySelector('pre code');
      const pre = wrap?.querySelector('pre');
      navigator.clipboard.writeText(code?.innerText || pre?.innerText || '').then(() => {
        btn.textContent = t('copiedCheck');
        setTimeout(() => {
          btn.textContent = t('copy');
        }, 1500);
      });
    });
  });
}

function applyRenderedMarkdown(target, rendered) {
  if (!target || !rendered) return;
  target.className = rendered.className;
  target.innerHTML = rendered.innerHTML;
  bindMarkdownInteractions(target);
}

function protectUrls(text) {
  return text.replace(/(^|[\s\n])(https?:\/\/[^\s<>\])]*)/g, (m, pre, url) =>
    pre + '<' + url + '>'
  );
}

function buildRenderedMarkdownHtml(text) {
  if (typeof marked === 'undefined') return null;
  const html = marked.parse(protectUrls(text), { breaks: true, gfm: true });
  const div = document.createElement('div');
  div.className = 'bubble md';
  div.innerHTML = html;

  div.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    const lang = (code?.className.match(/language-(\w+)/) || [])[1] || '';
    const wrap = document.createElement('div'); wrap.className = 'code-wrap';
    const header = document.createElement('div'); header.className = 'code-header';
    const langLabel = document.createElement('span'); langLabel.className = 'code-lang'; langLabel.textContent = lang;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = t('copy');
    header.appendChild(langLabel); header.appendChild(btn);
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(header); wrap.appendChild(pre);
  });
  return div.innerHTML;
}

function renderMarkdown(text, options = {}) {
  const useCache = options.useCache !== false;
  const bind = options.bind !== false;
  let html = null;
  if (useCache) {
    html = markdownRenderCache.get(getMarkdownRenderCacheKey(text)) || null;
  }
  if (!html) {
    html = buildRenderedMarkdownHtml(text);
    if (html == null) return null;
    if (useCache) {
      markdownRenderCache.set(getMarkdownRenderCacheKey(text), html);
      trimMarkdownRenderCache();
    }
  }
  const div = document.createElement('div');
  div.className = 'bubble md';
  div.innerHTML = html;
  if (bind) bindMarkdownInteractions(div);
  return div;
}

// ── Render messages ──
function renderMessages(messages) {
  messagesEl.innerHTML = '';
  if (!messages.length) {
    messagesEl.innerHTML = buildWelcomeMarkup();
    return;
  }
  const fragment = document.createDocumentFragment();
  messages.forEach((m, i) => addBubbleFromMsg(m, i, fragment));
  messagesEl.appendChild(fragment);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendBubbleExtraParts(bubble, content) {
  if (!Array.isArray(content)) return;
  content.forEach(part => {
    if (part.type === 'image_url') {
      const img = document.createElement('img');
      img.src = part.image_url.url;
      bubble.appendChild(img);
    } else if (part.type === 'file_text') {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.textContent = '📄 ' + part.name;
      bubble.appendChild(chip);
    }
  });
}

function createSourceBadges(sources) {
  if (!sources?.length) return null;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:0 2px;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
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
  const hint = action === 'inspect' ? t('sourceDetailHint') : t('sourceUnavailable');
  return [info.title || info.label, hint].filter(Boolean).join('\n');
}

function applySourceBadgeStyle(chip, active) {
  chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;background:${active ? 'rgba(16,163,127,0.22)' : 'rgba(16,163,127,0.12)'};border:1px solid ${active ? 'rgba(16,163,127,0.46)' : 'rgba(16,163,127,0.28)'};color:${active ? '#eafff6' : '#9ae6c8'};font-size:11px;line-height:1.4;cursor:${chip.disabled ? 'default' : 'pointer'};appearance:none;font:inherit;outline:none;`;
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

function ensureContentScriptInjected(tabId) {
  return new Promise(resolve => {
    chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
      resolve(!chrome.runtime.lastError);
    });
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
  const url = EasyChatCore.getContextSourceUrl(source);
  if (!url) {
    toast(t('sourceUnavailable'));
    return false;
  }

  const tab = await openSourceTab(url);
  if (!tab?.id) {
    toast(t('sourceUnavailable'));
    return false;
  }

  const ready = await waitForTabReady(tab.id);
  if (!ready) {
    toast(t('sourceOpened'));
    return false;
  }

  const injected = await ensureContentScriptInjected(tab.id);
  if (!injected) {
    toast(t('sourceOpened'));
    return false;
  }

  const resp = await tabMessage(tab.id, { type: 'HIGHLIGHT_CONTEXT_SOURCE', source });
  if (resp?.ok) {
    toast(getSourceLocateMessage(resp));
    return true;
  }

  toast(resp?.error === 'text_not_found' ? t('sourceLocateFallback') : t('sourceOpened'));
  return false;
}

function getSourceLocateMessage(resp) {
  if (resp?.loose) return t('sourceLocatedLoose');
  if (resp?.matchedKind === 'title') return t('sourceLocatedTitle');
  if (resp?.matchedKind === 'preview') return t('sourceLocatedPreview');
  return t('sourceLocated');
}

async function copySourceSummary(source) {
  const summary = EasyChatCore.hasContextSourceDetails(source)
    ? EasyChatCore.buildContextSourceSummary(source)
    : '';
  if (!summary) {
    toast(t('sourceUnavailable'));
    return false;
  }

  try {
    await navigator.clipboard.writeText(summary);
    toast(t('sourceCopied'));
    return true;
  } catch {
    toast(t('sourceUnavailable'));
    return false;
  }
}

function createSourceDetailActionButton(label, accent) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;border:1px solid ${accent ? 'rgba(16,163,127,0.42)' : 'rgba(255,255,255,0.14)'};background:${accent ? 'rgba(16,163,127,0.16)' : 'rgba(255,255,255,0.04)'};color:${accent ? '#eafff6' : '#b7c7c1'};font-size:11px;cursor:pointer;appearance:none;font:inherit;`;
  return btn;
}

function createSourceDetailCard(source) {
  const info = EasyChatCore.describeContextSource(source);
  const url = EasyChatCore.getContextSourceUrl(source);
  const summary = EasyChatCore.buildContextSourceSummary(source);
  const card = document.createElement('div');
  card.style.cssText = 'padding:11px 12px;border-radius:12px;border:1px solid rgba(16,163,127,0.22);background:rgba(16,24,39,0.62);display:flex;flex-direction:column;gap:8px;';

  const kicker = document.createElement('div');
  kicker.textContent = t('sourceDetailsTitle');
  kicker.style.cssText = 'font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3b7;';
  card.appendChild(kicker);

  const label = document.createElement('div');
  label.textContent = info.text;
  label.style.cssText = 'font-size:12px;font-weight:600;color:#f0fffa;';
  card.appendChild(label);

  if (source?.title) {
    const title = document.createElement('div');
    title.textContent = source.title;
    title.style.cssText = 'font-size:12px;line-height:1.55;color:#d7e5df;';
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
    previewTitle.textContent = t('sourcePreviewTitle');
    previewTitle.style.cssText = 'font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#8ca29b;';
    card.appendChild(previewTitle);

    const preview = document.createElement('div');
    preview.textContent = source.preview;
    preview.style.cssText = 'font-size:12px;line-height:1.6;color:#cad7d2;white-space:pre-wrap;';
    card.appendChild(preview);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
  const askBtn = createSourceDetailActionButton(t('sourceAskBtn'), !url && !summary);
  askBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    attachSourceFollowupContext(source);
  });
  actions.appendChild(askBtn);
  if (url) {
    if (source?.preview || source?.title) {
      const locateBtn = createSourceDetailActionButton(t('sourceLocateBtn'), true);
      locateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await locateSourceInPage(source);
      });
      actions.appendChild(locateBtn);
    }

    const openBtn = createSourceDetailActionButton(t('sourceOpenBtn'), !(source?.preview || source?.title));
    openBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const opened = await openSourceUrl(url);
      toast(opened ? t('sourceOpened') : t('sourceUnavailable'));
    });
    actions.appendChild(openBtn);
  }
  if (summary) {
    const copyBtn = createSourceDetailActionButton(t('sourceCopyBtn'), false);
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

function addBubbleFromMsg(m, idx, host = messagesEl) {
  const row = document.createElement('div');
  row.className = 'msg-row ' + (m.role === 'user' ? 'user' : 'ai');
  const av = document.createElement('div');
  av.className = 'avatar ' + (m.role === 'user' ? 'user' : 'ai');
  if (m.role === 'user') {
    if (config.userAvatar) {
      const img = document.createElement('img');
      img.src = config.userAvatar;
      av.appendChild(img);
    } else {
      av.textContent = '👤';
    }
  } else {
    if (config.aiAvatar) {
      const img = document.createElement('img');
      img.src = config.aiAvatar;
      av.appendChild(img);
    } else {
      av.textContent = '🤖';
    }
  }
  const wrap = document.createElement('div'); wrap.className = 'bubble-wrap';

  let bubble;
  if (m.role === 'assistant' && typeof m.content === 'string') {
    bubble = renderMarkdown(m.content) || (() => { const d = document.createElement('div'); d.className = 'bubble'; d.textContent = m.content; return d; })();
  } else {
    bubble = document.createElement('div'); bubble.className = 'bubble';
    // Use display text if available (set by popup for context-attachment messages)
    const displayText = m.display;
    if (displayText) {
      const parsed = EasyChatCore.parseDisplayText(displayText);
      if (parsed?.tagged) {
        const tag = document.createElement('span');
        tag.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:rgba(16,163,127,0.15);border:1px solid rgba(16,163,127,0.4);border-radius:10px;padding:1px 7px;font-size:11px;color:#10a37f;margin-right:5px;white-space:nowrap;';
        tag.textContent = parsed.label;
        bubble.appendChild(tag);
        if (parsed.text) bubble.appendChild(document.createTextNode(parsed.text));
      } else {
        bubble.textContent = displayText;
      }
      appendBubbleExtraParts(bubble, m.content);
    } else if (typeof m.content === 'string') {
      bubble.textContent = m.content;
    } else if (Array.isArray(m.content)) {
      m.content.forEach(part => {
        if (part.type === 'text') {
          const t = document.createElement('span');
          t.textContent = part.text;
          bubble.appendChild(t);
        }
      });
      appendBubbleExtraParts(bubble, m.content);
    }
  }

  // Timestamp
  const time = document.createElement('div'); time.className = 'msg-time';
  time.textContent = m.time ? new Date(m.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';

  // Actions
  const messageSources = m.role === 'assistant'
    ? EasyChatCore.getMessageContextSources(m)
    : [];
  const actions = document.createElement('div'); actions.className = 'msg-actions';
  actions.appendChild(makeActBtn(t('copy'), () => { navigator.clipboard.writeText(getPlainText(m.content)).then(() => toast(t('copied'))); }));
  if (m.role === 'assistant' && canApplyAssistantMessage(m)) actions.appendChild(makeActBtn(t('applyToPage'), () => applyAssistantMessageToPage(m)));
  if (messageSources.length > 1) actions.appendChild(makeActBtn(t('sourcesAskBtn'), () => attachSourcesFollowupContext(messageSources)));
  if (m.role === 'assistant') actions.appendChild(makeActBtn(t('regenerate'), () => regenerate(idx)));
  if (m.role === 'user') actions.appendChild(makeActBtn(t('editResend'), () => editAndResend(idx)));
  actions.appendChild(makeActBtn(t('deleteBtn'), () => deleteMessage(idx), true));

  const sourceBadges = m.role === 'assistant'
    ? createSourceBadges(messageSources)
    : null;

  wrap.appendChild(bubble);
  if (sourceBadges) wrap.appendChild(sourceBadges);
  wrap.appendChild(time);
  wrap.appendChild(actions);
  row.appendChild(av); row.appendChild(wrap);
  host.appendChild(row);
  return bubble;
}

function makeActBtn(label, onClick, danger = false) {
  const btn = document.createElement('button');
  btn.className = 'act-btn' + (danger ? ' danger' : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}
function getPlainText(content) {
  return EasyChatCore.extractPlainText(content);
}
function deleteMessage(idx) {
  const s = current(); if (!s) return;
  s.messages.splice(idx, 1); save(); renderMessages(s.messages); updateStats(); toast(t('messageDeleted'));
}
function editAndResend(idx) {
  const s = current(); if (!s) return;
  const text = getPlainText(s.messages[idx].content);
  s.messages.splice(idx); save(); renderMessages(s.messages);
  userInput.value = text; userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
  userInput.focus();
}
async function regenerate(idx) {
  if (streaming) return;
  const s = current(); if (!s) return;
  s.messages.splice(idx); save(); renderMessages(s.messages);
  await doRequest(s);
}

function addErrorBubble(msg) {
  const row = document.createElement('div'); row.className = 'msg-row ai';
  const av = createAiAvatarElement();
  const bubble = document.createElement('div'); bubble.className = 'error-msg'; bubble.textContent = '⚠ ' + msg;
  row.appendChild(av); row.appendChild(bubble);
  messagesEl.appendChild(row); scrollBottom();
}

function createAiAvatarElement(extraClass = '') {
  const av = document.createElement('div');
  av.className = `avatar ai${extraClass ? ` ${extraClass}` : ''}`;
  if (config.aiAvatar) {
    const img = document.createElement('img');
    img.src = config.aiAvatar;
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
    row.className = 'typing-row';
    row.id = 'typing';
    const av = createAiAvatarElement('typing-avatar');
    const stage = document.createElement('div');
    stage.className = 'typing-stage';
    row.appendChild(av);
    row.appendChild(stage);
    messagesEl.appendChild(row);
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

function toApiContent(content) {
  return EasyChatCore.toApiContent(content);
}

// ── Send ──
async function send() {
  if (streaming) return;
  const text = userInput.value.trim();
  const ctx = draftSourceContext;
  if (!text && !attachments.length && !ctx) return;
  if (!config.apiKey) { overlay.classList.add('show'); return; }
  if (!currentId) newChat();
  const s = current();
  const w = messagesEl.querySelector('.welcome');
  if (w) w.remove();

  const apiText = ctx ? ctx.promptFn(text) : text;
  const displayText = EasyChatCore.buildDisplayText({
    context: ctx,
    userText: text,
    webSearchEnabled
  });

  const userMsg = EasyChatCore.createUserMessage({
    text: apiText,
    imageUrls: attachments.filter(a => a.type === 'image').map(a => `data:${a.mimeType};base64,${a.base64}`),
    fileAttachments: attachments.filter(a => a.type === 'file').map(a => ({ name: a.name, text: a.text })),
    display: displayText,
    meta: EasyChatCore.buildMessageMeta({
      contextAction: ctx?.type,
      contextLabel: ctx?.label,
      sources: [...(ctx?.meta?.contextSources || [])],
      imageAttachments: attachments.filter(a => a.type === 'image').map(a => ({
        kind: 'image',
        label: a.name || (currentLanguage === 'en' ? 'Image' : '图片'),
        name: a.name,
        mimeType: a.mimeType
      })),
      fileAttachments: attachments.filter(a => a.type === 'file').map(a => ({
        name: a.name,
        text: a.text
      })),
      webSearchEnabled
    }),
    time: Date.now()
  });
  s.messages.push(userMsg);
  if (s.messages.length === 1) {
    s.title = (text || ctx?.label || attachments[0]?.name || t('newChat')).slice(0, 28);
    topbarTitle.textContent = s.title;
  }
  addBubbleFromMsg(userMsg, s.messages.length - 1);
  userInput.value = ''; userInput.style.height = 'auto';
  draftSourceContext = null;
  renderDraftContextTag();
  attachments = []; renderAttachments();
  chrome.storage.local.remove('pendingScreenshot');
  save(); renderHistory(); updateStats(); autoScroll = true;

  // Web search if enabled (do it after displaying user message)
  let searchResult = null;
  if (webSearchEnabled && text) {
    showTyping(); // Show typing indicator during search
    searchResult = await tavilySearch(text);
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

  await doRequest(s, searchResult);
}

async function doRequest(s, searchResult = null) {
  streaming = true; sendBtn.style.display = 'none'; stopBtn.style.display = 'flex'; showTyping();
  abortController = new AbortController();

  const baseUrl = EasyChatCore.normalizeBaseUrl(config.baseUrl);
  const model = getModel();
  const turnContext = EasyChatCore.resolveTurnContext(s.messages, { includeWebSearch: !!searchResult });
  const assistantMeta = EasyChatCore.buildAssistantMetaFromContext(turnContext);

  // Build messages with context limit
  let msgs = s.messages.map(m => ({ role: m.role, content: toApiContent(m.content) }));
  if (config.contextLimit) msgs = msgs.slice(-parseInt(config.contextLimit));

  EasyChatCore.appendSearchResultToLastUserMessage(msgs, searchResult, currentLanguage === 'en' ? 'Web search results' : '联网搜索结果');

  // Prepend system prompt
  const formatInstruction = 'Always format your responses using Markdown: use ## or ### for section headings, **bold** for key terms, bullet points or numbered lists for enumerations, and ``` code blocks ``` for any code. Structure longer answers with clear headings and sections.';
  const promptTail = [formatInstruction, EasyChatCore.buildSourceAwareInstruction(turnContext)].filter(Boolean).join('\n\n');
  const sysContent = EasyChatCore.buildSystemMessage(config.systemPrompt, promptTail, promptTail);
  msgs = [{ role: 'system', content: sysContent }, ...msgs];

  const body = EasyChatCore.buildChatRequestBody({
    model,
    messages: msgs,
    stream: config.streamEnabled ?? true,
    temperature: config.temperature ?? 0.7,
    topP: config.topP ?? 1.0,
    frequencyPenalty: config.frequencyPenalty ?? 0.0,
    presencePenalty: config.presencePenalty ?? 0.0,
    maxTokens: config.maxTokens
  });

  let bubble = null;

  try {
    // Non-streaming mode
    if (!config.streamEnabled) {
      const data = await EasyChatCore.requestChatCompletionJson({
        baseUrl,
        apiKey: config.apiKey,
        body,
        signal: abortController.signal
      });
      removeTyping();
      const rawContent = data.choices?.[0]?.message?.content || '';
      const content = sanitizeVisibleReasoningText(rawContent, model).trim() || extractStreamableAnswerText(rawContent, model).trim();
      if (!content) throw new Error(currentLanguage === 'en' ? 'Model returned no displayable content' : '模型未返回可显示正文');

      // Record token usage
      if (data.usage) {
        recordTokenUsage(model, data.usage);
      }

      const aiMsg = EasyChatCore.createAssistantMessage({ content, time: Date.now(), meta: assistantMeta });
      s.messages.push(aiMsg);
      save(); updateStats();
      addBubbleFromMsg(aiMsg, s.messages.length - 1);
      scrollBottom();
      return;
    }

    // Streaming mode with real-time markdown rendering
    let full = '';
    let row = null;
    let wrap = null;
    let mdBubble = null;
    function ensureAssistantBubble() {
      if (bubble) return;
      removeTyping();
      row = document.createElement('div'); row.className = 'msg-row ai';
      const av = createAiAvatarElement();
      wrap = document.createElement('div'); wrap.className = 'bubble-wrap';
      bubble = document.createElement('div'); bubble.className = 'bubble';
      wrap.appendChild(bubble); row.appendChild(av); row.appendChild(wrap);
      messagesEl.appendChild(row);
    }
    let lastRenderTime = 0;
    const RENDER_INTERVAL = 100; // Render markdown every 100ms
    const { full: streamedFull, usage: usageData } = await EasyChatCore.streamChatCompletion({
      baseUrl,
      apiKey: config.apiKey,
      body,
      signal: abortController.signal,
      onChunk: ({ delta, full: chunkFull }) => {
        if (!delta) return;
        full = chunkFull;
        const visibleText = extractStreamableAnswerText(full, model).trim();
        if (!visibleText) {
          showReasoningPreview(full, model);
          chrome.runtime.sendMessage({ type: 'CHAT_CHUNK', full: '', rawFull: full, model, sessionId: s.id }).catch(() => {});
          scrollBottom();
          return;
        }
        const now = Date.now();
        if (now - lastRenderTime > RENDER_INTERVAL) {
          ensureAssistantBubble();
          const rendered = renderMarkdown(visibleText, { useCache: false, bind: false });
          if (rendered) {
            if (!mdBubble) {
              bindMarkdownInteractions(rendered);
              bubble.replaceWith(rendered);
              mdBubble = rendered;
            } else {
              applyRenderedMarkdown(mdBubble, rendered);
            }
          } else {
            (mdBubble || bubble).textContent = visibleText;
          }
          lastRenderTime = now;
          chrome.runtime.sendMessage({ type: 'CHAT_CHUNK', full: visibleText, rawFull: full, model, sessionId: s.id }).catch(() => {});
        }
        scrollBottom();
      }
    });
    full = streamedFull;

    const finalText = sanitizeVisibleReasoningText(full, model).trim() || extractStreamableAnswerText(full, model).trim();
    if (!finalText) {
      removeTyping();
      throw new Error('模型未返回可显示正文');
    }
    ensureAssistantBubble();
    const finalRendered = renderMarkdown(finalText, { bind: false });
    if (finalRendered) {
      if (!mdBubble) {
        bindMarkdownInteractions(finalRendered);
        bubble.replaceWith(finalRendered);
        mdBubble = finalRendered;
      } else {
        applyRenderedMarkdown(mdBubble, finalRendered);
      }
    } else {
      (mdBubble || bubble).textContent = finalText;
    }

    // Record token usage if available
    if (usageData) {
      recordTokenUsage(model, usageData);
    }

    const aiMsg = EasyChatCore.createAssistantMessage({ content: finalText, time: Date.now(), meta: assistantMeta });
    const idx = s.messages.length;
    s.messages.push(aiMsg); save(); updateStats();
    // Notify popup that streaming is done
    chrome.runtime.sendMessage({ type: 'CHAT_DONE', full: finalText, rawFull: full, model, sessionId: s.id }).catch(() => {});

    // Time + actions
    const sourceBadges = createSourceBadges(aiMsg.meta?.contextSources);
    const time = document.createElement('div'); time.className = 'msg-time';
    time.textContent = new Date(aiMsg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const actions = document.createElement('div'); actions.className = 'msg-actions';
    actions.appendChild(makeActBtn(t('copy'), () => { navigator.clipboard.writeText(finalText).then(() => toast(t('copied'))); }));
    if (canApplyAssistantMessage(aiMsg)) actions.appendChild(makeActBtn(t('applyToPage'), () => applyAssistantMessageToPage(aiMsg)));
    if ((aiMsg.meta?.contextSources?.length || 0) > 1) actions.appendChild(makeActBtn(t('sourcesAskBtn'), () => attachSourcesFollowupContext(aiMsg.meta.contextSources)));
    actions.appendChild(makeActBtn(t('regenerate'), () => regenerate(idx)));
    actions.appendChild(makeActBtn(t('deleteBtn'), () => deleteMessage(idx), true));
    if (sourceBadges) wrap.appendChild(sourceBadges);
    wrap.appendChild(time); wrap.appendChild(actions);

  } catch (err) {
    removeTyping();
    if (err.name !== 'AbortError') {
      if (bubble) {
        bubble.className = 'error-msg';
        bubble.textContent = '⚠ ' + err.message;
      } else {
        addErrorBubble(err.message);
      }
    }
    else toast(t('generationStopped'));
  } finally {
    streaming = false; abortController = null;
    sendBtn.style.display = 'flex'; stopBtn.style.display = 'none';
    userInput.focus();
  }
}

// ── Clear all sessions ──
document.getElementById('clearAllBtn').addEventListener('click', () => {
  confirm2(t('confirmClearAllChats'), () => {
    sessions = [];
    currentId = null;
    chrome.storage.local.set({ sessions: [] });
    renderHistory();
    renderMessages([]);
    topbarTitle.textContent = t('newChat');
    updateStats();
    toast(t('allChatsCleared'));
  });
});

// ── Clear all data ──
document.getElementById('clearAllDataBtn').addEventListener('click', () => {
  confirm2(t('clearAllDataConfirm'), () => {
    chrome.storage.local.clear(() => {
      sessions = [];
      currentId = null;
      config = { baseUrl: '', apiKey: '', systemPrompt: '', temperature: 0.7, topP: 1.0, frequencyPenalty: 0.0, presencePenalty: 0.0, maxTokens: '', contextLimit: '', searchEngine: 'tavily', searchApiKey: '', streamEnabled: true, userAvatar: '', aiAvatar: '', model: 'gpt-4o' };
      profiles = {};
      currentProfile = 'default';
      tokenUsage = {};
      renderHistory();
      renderMessages([]);
      topbarTitle.textContent = t('newChat');
      updateStats();
      toast(t('allDataCleared'));
      setTimeout(() => location.reload(), 1000);
    });
  });
});

// ── Clear token usage ──
document.getElementById('clearTokenUsageBtn').addEventListener('click', () => {
  confirm2(t('confirmClearTokenStats'), () => {
    tokenUsage = {};
    chrome.storage.local.set({ tokenUsage });
    renderTokenUsageStats();
    toast('Token 统计已清除');
  });
});

// ── Render token usage stats ──
function renderTokenUsageStats() {
  const container = document.getElementById('tokenUsageStats');
  if (!container) return;

  const models = Object.keys(tokenUsage);
  if (models.length === 0) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:13px;">${t('noData')}</div>`;
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:12px;">';

  // Calculate total
  let totalPrompt = 0, totalCompletion = 0, totalAll = 0;
  models.forEach(model => {
    totalPrompt += tokenUsage[model].prompt_tokens || 0;
    totalCompletion += tokenUsage[model].completion_tokens || 0;
    totalAll += tokenUsage[model].total_tokens || 0;
  });

  // Total summary
  html += `
    <div style="padding:10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--accent);">
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;">📊 总计</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6;">
        输入: ${totalPrompt.toLocaleString()} tokens<br>
        输出: ${totalCompletion.toLocaleString()} tokens<br>
        总计: ${totalAll.toLocaleString()} tokens
      </div>
    </div>
  `;

  // Per model breakdown
  models.sort((a, b) => (tokenUsage[b].total_tokens || 0) - (tokenUsage[a].total_tokens || 0));
  models.forEach(model => {
    const usage = tokenUsage[model];
    html += `
      <div style="padding:10px;background:var(--surface2);border-radius:6px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:6px;">${model}</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.6;">
          输入: ${(usage.prompt_tokens || 0).toLocaleString()} tokens<br>
          输出: ${(usage.completion_tokens || 0).toLocaleString()} tokens<br>
          总计: ${(usage.total_tokens || 0).toLocaleString()} tokens
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ── Avatar upload ──
document.getElementById('uploadUserAvatar').addEventListener('click', () => {
  document.getElementById('userAvatarFile').click();
});
document.getElementById('uploadAiAvatar').addEventListener('click', () => {
  document.getElementById('aiAvatarFile').click();
});

document.getElementById('userAvatarFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    config.userAvatar = ev.target.result;
    userAvatarInput.value = t('avatarUploaded');
    profiles[currentProfile] = { ...config };
    chrome.storage.local.set({ config, profiles });
    toast(t('userAvatarUploaded'));
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.getElementById('aiAvatarFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    config.aiAvatar = ev.target.result;
    aiAvatarInput.value = t('avatarUploaded');
    profiles[currentProfile] = { ...config };
    chrome.storage.local.set({ config, profiles });
    toast(t('aiAvatarUploaded'));
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.getElementById('clearUserAvatar').addEventListener('click', () => {
  config.userAvatar = '';
  userAvatarInput.value = '';
  profiles[currentProfile] = { ...config };
  chrome.storage.local.set({ config, profiles });
  toast(t('userAvatarCleared'));
});

document.getElementById('clearAiAvatar').addEventListener('click', () => {
  config.aiAvatar = '';
  aiAvatarInput.value = '';
  profiles[currentProfile] = { ...config };
  chrome.storage.local.set({ config, profiles });
  toast('AI 头像已清除');
});

// ── Profiles management ──
document.getElementById('createProfileBtn').addEventListener('click', () => {
  const name = document.getElementById('newProfileName').value.trim();
  if (!name) { toast(t('pleaseEnterProfileName')); return; }
  if (profiles[name]) { toast(t('profileExists')); return; }
  profiles[name] = { ...config };
  chrome.storage.local.set({ profiles });
  document.getElementById('newProfileName').value = '';
  renderProfiles();
  toast(`配置文件 "${name}" 已创建`);
});

// Modal version
document.getElementById('createProfileBtnModal').addEventListener('click', () => {
  const name = document.getElementById('newProfileNameModal').value.trim();
  if (!name) { toast(t('pleaseEnterProfileName')); return; }
  if (profiles[name]) { toast(t('profileExists')); return; }
  profiles[name] = { ...config };
  chrome.storage.local.set({ profiles });
  document.getElementById('newProfileNameModal').value = '';
  renderProfiles();
  renderProfilesModal();
  toast(`配置文件 "${name}" 已创建`);
});

function renderProfiles() {
  const list = document.getElementById('profilesList');
  if (!list) return;
  list.innerHTML = '';
  Object.keys(profiles).forEach(name => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;';
    if (name === currentProfile) item.style.borderColor = 'var(--accent)';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.cssText = 'flex:1;font-size:13px;color:var(--text);';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = t('loadBtn');
    loadBtn.style.cssText = 'padding:4px 12px;background:var(--accent);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;';
    loadBtn.addEventListener('click', () => loadProfile(name));

    const delBtn = document.createElement('button');
    delBtn.textContent = t('deleteBtn');
    delBtn.style.cssText = 'padding:4px 12px;background:transparent;color:#f87171;border:1px solid #6b2a2a;border-radius:5px;cursor:pointer;font-size:12px;';
    delBtn.addEventListener('click', () => deleteProfile(name));

    item.appendChild(nameSpan);
    if (name !== currentProfile) item.appendChild(loadBtn);
    if (name !== 'default') item.appendChild(delBtn);
    list.appendChild(item);
  });
}

function renderProfilesModal() {
  const list = document.getElementById('profilesListModal');
  if (!list) return;
  list.innerHTML = '';
  Object.keys(profiles).forEach(name => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;';
    if (name === currentProfile) item.style.borderColor = 'var(--accent)';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.cssText = 'flex:1;font-size:13px;color:var(--text);';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = t('loadBtn');
    loadBtn.style.cssText = 'padding:4px 12px;background:var(--accent);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;';
    loadBtn.addEventListener('click', () => loadProfile(name));

    const delBtn = document.createElement('button');
    delBtn.textContent = t('deleteBtn');
    delBtn.style.cssText = 'padding:4px 12px;background:transparent;color:#f87171;border:1px solid #6b2a2a;border-radius:5px;cursor:pointer;font-size:12px;';
    delBtn.addEventListener('click', () => deleteProfile(name));

    item.appendChild(nameSpan);
    if (name !== currentProfile) item.appendChild(loadBtn);
    if (name !== 'default') item.appendChild(delBtn);
    list.appendChild(item);
  });
}

function loadProfile(name) {
  if (!profiles[name]) return;
  currentProfile = name;
  config = { ...config, ...profiles[name] };

  baseUrlInput.value = config.baseUrl || '';
  apiKeyInput.value = config.apiKey || '';
  systemPromptInput.value = config.systemPrompt || '';
  tempInput.value = config.temperature ?? 0.7;
  tempVal.textContent = tempInput.value;
  topPInput.value = config.topP ?? 1.0;
  topPVal.textContent = topPInput.value;
  freqPenaltyInput.value = config.frequencyPenalty ?? 0.0;
  freqPenaltyVal.textContent = freqPenaltyInput.value;
  presPenaltyInput.value = config.presencePenalty ?? 0.0;
  presPenaltyVal.textContent = presPenaltyInput.value;
  maxTokensInput.value = config.maxTokens || '';
  contextLimitInput.value = config.contextLimit || '';
  searchEngineSelect.value = config.searchEngine || 'tavily';
  searchApiKeyInput.value = config.searchApiKey || '';
  customSearchUrlInput.value = config.customSearchUrl || '';
  customSearchUrlInput2.value = config.customSearchUrl2 || '';
  customSearchUrlInput3.value = config.customSearchUrl3 || '';
  if (config.searchEngine === 'custom') {
    customSearchUrlField.style.display = 'block';
  } else if (config.searchEngine === 'custom2') {
    customSearchUrlField2.style.display = 'block';
  } else if (config.searchEngine === 'custom3') {
    customSearchUrlField3.style.display = 'block';
  }
  streamToggle.checked = config.streamEnabled ?? true;
  selMenuToggle.checked = config.selMenuEnabled ?? true;
  selMenuAsk.checked = config.selMenuAsk ?? true;
  selMenuRewrite.checked = config.selMenuRewrite ?? true;
  selMenuTranslate.checked = config.selMenuTranslate ?? true;
  selMenuSummarize.checked = config.selMenuSummarize ?? true;
  selMenuAnnotate.checked = config.selMenuAnnotate ?? true;
  selMenuCopy.checked = config.selMenuCopy ?? true;
  selMenuToggle.dispatchEvent(new Event('change'));
  userAvatarInput.value = config.userAvatar ? t('avatarUploaded') : '';
  aiAvatarInput.value = config.aiAvatar ? t('avatarUploaded') : '';

  config.model = config.model || 'gpt-4o';
  updateCurrentModelDisplay();

  if (config.model === 'custom') {
    customModelWrap.style.display = 'inline';
    customModelInput.value = config.customModel || '';
  }

  chrome.storage.local.set({ config, currentProfile });
  updateApiStatus();
  updateStats();
  renderProfiles();
  renderProfilesModal();
  toast(`${t('profileLoaded')} "${name}"`);
}

function deleteProfile(name) {
  if (name === 'default') { toast(t('cannotDeleteDefault')); return; }
  if (name === currentProfile) { toast(t('cannotDeleteCurrent')); return; }
  confirm2(`${t('confirmDeleteProfile')} "${name}"?`, () => {
    delete profiles[name];
    chrome.storage.local.set({ profiles });
    renderProfiles();
    renderProfilesModal();
    toast(`${t('profileDeleted')} "${name}"`);
  });
}

// ── Confirm dialog ──
function confirm2(msg, onYes) {
  const overlay = document.getElementById('confirmOverlay');
  const msgEl = document.getElementById('confirmMsg');
  const yesBtn = document.getElementById('confirmYes');
  const noBtn = document.getElementById('confirmNo');
  msgEl.textContent = msg;
  overlay.style.display = 'flex';
  const yes = () => { overlay.style.display = 'none'; onYes(); cleanup(); };
  const no = () => { overlay.style.display = 'none'; cleanup(); };
  const cleanup = () => { yesBtn.removeEventListener('click', yes); noBtn.removeEventListener('click', no); };
  yesBtn.addEventListener('click', yes);
  noBtn.addEventListener('click', no);
}


// ── Popup Proxy: handle send requests from popup ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SET_CHAT_HOST_WINDOW') {
    hostWindowId = msg.windowId || hostWindowId;
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'OPEN_CHAT_SESSION') {
    const sessionId = String(msg.sessionId || '');
    if (!sessionId || !sessions.find(s => s.id === sessionId)) {
      sendResponse({ ok: false, error: 'session_not_found' });
      return true;
    }
    loadSession(sessionId, { syncStorage: false, forceRender: true });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type !== 'PROXY_SEND') return false;

  const { sessionId, messages, searchResult, cfg } = msg;

  // Sync session into local state
  let s = sessions.find(s => s.id === sessionId);
  if (!s) {
    s = { id: sessionId, title: messages[0]?.content?.slice?.(0, 28) || 'Chat', messages: [], createdAt: Date.now() };
    sessions.unshift(s);
  }
  s.messages = messages;
  const mirrorProxyUi = currentId === sessionId;

  // Merge config overrides (apiKey, model, etc from popup profile)
  const savedConfig = { ...config };
  Object.assign(config, cfg);
  if (mirrorProxyUi) showTyping();

  // Run the request, streaming chunks back to popup via background
  (async () => {
    proxyStreaming = true;
    const baseUrl = EasyChatCore.normalizeBaseUrl(config.baseUrl);
    const model = getModel();
    const turnContext = EasyChatCore.resolveTurnContext(s.messages, { includeWebSearch: !!searchResult });
    const assistantMeta = EasyChatCore.buildAssistantMetaFromContext(turnContext);

    let apiMsgs = s.messages.map(m => ({ role: m.role, content: toApiContent(m.content) }));
    if (config.contextLimit) apiMsgs = apiMsgs.slice(-parseInt(config.contextLimit));

    EasyChatCore.appendSearchResultToLastUserMessage(apiMsgs, searchResult, currentLanguage === 'en' ? 'Web search results' : '联网搜索结果');

    const formatInstruction = 'Always format your responses using Markdown.';
    const promptTail = [formatInstruction, EasyChatCore.buildSourceAwareInstruction(turnContext)].filter(Boolean).join('\n\n');
    const sysContent = EasyChatCore.buildSystemMessage(config.systemPrompt, promptTail, promptTail);
    apiMsgs = [{ role: 'system', content: sysContent }, ...apiMsgs];

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

    let full = '';
    let proxyRow = null;
    let proxyWrap = null;
    let proxyBubble = null;
    let proxyMdBubble = null;
    function ensureProxyAssistantBubble() {
      if (!mirrorProxyUi) return null;
      if (proxyBubble) return;
      removeTyping();
      proxyRow = document.createElement('div');
      proxyRow.className = 'msg-row ai';
      proxyWrap = document.createElement('div');
      proxyWrap.className = 'bubble-wrap';
      proxyBubble = document.createElement('div');
      proxyBubble.className = 'bubble';
      proxyWrap.appendChild(proxyBubble);
      proxyRow.appendChild(createAiAvatarElement());
      proxyRow.appendChild(proxyWrap);
      messagesEl.appendChild(proxyRow);
    }
    let lastRender = 0;
    try {
      const { full: streamedFull } = await EasyChatCore.streamChatCompletion({
        baseUrl,
        apiKey: config.apiKey,
        body,
        onChunk: ({ delta, full: chunkFull }) => {
          if (!delta) return;
          full = chunkFull;
          const visibleText = extractStreamableAnswerText(full, model).trim();
          if (!visibleText) {
            if (mirrorProxyUi) {
              showReasoningPreview(full, model);
              scrollBottom();
            }
            chrome.runtime.sendMessage({ type: 'PROXY_CHUNK', delta: '', full: '', rawFull: full, model });
            return;
          }
          const now = Date.now();
          if (now - lastRender > 80) {
            if (mirrorProxyUi) {
              ensureProxyAssistantBubble();
              const rendered = renderMarkdown(visibleText, { useCache: false, bind: false });
              if (rendered) {
                if (!proxyMdBubble) {
                  bindMarkdownInteractions(rendered);
                  proxyBubble.replaceWith(rendered);
                  proxyMdBubble = rendered;
                } else {
                  applyRenderedMarkdown(proxyMdBubble, rendered);
                }
              } else {
                (proxyMdBubble || proxyBubble).textContent = visibleText;
              }
              scrollBottom();
            }
            chrome.runtime.sendMessage({ type: 'PROXY_CHUNK', delta, full: visibleText, rawFull: full, model });
            lastRender = now;
          }
        }
      });
      full = streamedFull;

      const finalText = sanitizeVisibleReasoningText(full, model).trim() || extractStreamableAnswerText(full, model).trim();
      if (!finalText) {
        if (mirrorProxyUi) removeTyping();
        throw new Error('模型未返回可显示正文');
      }
      if (mirrorProxyUi) {
        ensureProxyAssistantBubble();
        const rendered = renderMarkdown(finalText, { bind: false });
        if (rendered) {
          if (!proxyMdBubble) {
            bindMarkdownInteractions(rendered);
            proxyBubble.replaceWith(rendered);
            proxyMdBubble = rendered;
          } else {
            applyRenderedMarkdown(proxyMdBubble, rendered);
          }
        } else {
          (proxyMdBubble || proxyBubble).textContent = finalText;
        }
        const sourceBadges = createSourceBadges(assistantMeta.contextSources);
        if (sourceBadges) proxyWrap.appendChild(sourceBadges);
        scrollBottom();
      }

      // Save AI response into session
      const aiMsg = EasyChatCore.createAssistantMessage({ content: finalText, time: Date.now(), meta: assistantMeta });
      s.messages.push(aiMsg);
      save();
      renderHistory();
      updateStats();

      chrome.runtime.sendMessage({ type: 'PROXY_DONE', full: finalText, rawFull: full, model, sessionId });
    } catch (e) {
      if (mirrorProxyUi) {
        removeTyping();
        if (proxyBubble) {
          proxyBubble.className = 'error-msg';
          proxyBubble.textContent = '⚠ ' + e.message;
        } else {
          addErrorBubble(e.message);
        }
      }
      chrome.runtime.sendMessage({ type: 'PROXY_ERROR', error: e.message });
    } finally {
      proxyStreaming = false;
      Object.assign(config, savedConfig);
    }
  })();

  sendResponse({ ok: true });
  return true;
});
