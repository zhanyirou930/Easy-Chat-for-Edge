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
let hostWindowId = (() => {
  const raw = new URLSearchParams(location.search).get('sourceWindowId');
  const num = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(num) ? num : null;
})();

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
    fullOpenFailed: '打开完整界面失败'
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
    fullOpenFailed: 'Failed to open full window'
  }
};

function t(key) {
  return translations[currentLanguage]?.[key] || translations.zh[key] || key;
}

function bgMessage(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
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
const modelSelect = document.getElementById('modelSelect');
const customModelWrap = document.getElementById('customModelWrap');
const customModelInput = document.getElementById('customModelInput');
const apiStatus = document.getElementById('apiStatus');
const attachmentsEl = document.getElementById('attachments');
const searchInput = document.getElementById('searchInput');
const streamToggle = document.getElementById('streamToggle');
const userAvatarInput = document.getElementById('userAvatarInput');
const aiAvatarInput = document.getElementById('aiAvatarInput');

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
function renderModelCategories(filter = '') {
  modelCategories.innerHTML = '';
  const filterLower = filter.toLowerCase();

  Object.entries(modelData).forEach(([key, category]) => {
    const filteredModels = category.models.filter(m =>
      m.name.toLowerCase().includes(filterLower) || m.id.toLowerCase().includes(filterLower)
    );

    if (filteredModels.length === 0) return;

    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'model-category';

    const header = document.createElement('div');
    header.className = 'model-category-header';
    header.innerHTML = `<span class="arrow">▼</span><span>${category.name}</span>`;

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'model-category-items show';

    filteredModels.forEach(model => {
      const item = document.createElement('div');
      item.className = 'model-item';
      if (config.model === model.id) item.classList.add('active');
      item.title = model.id; // Show ID on hover

      let html = `<span>${model.name}</span>`;
      if (model.badge) html += `<span class="model-badge">${model.badge}</span>`;
      item.innerHTML = html;

      item.addEventListener('click', () => {
        config.model = model.id;
        currentModelSpan.textContent = model.name;
        modelDropdown.classList.remove('show');

        // Update hidden select for compatibility
        let opt = modelSelect.querySelector(`option[value="${model.id}"]`);
        if (!opt) {
          opt = document.createElement('option');
          opt.value = model.id;
          opt.textContent = model.name;
          modelSelect.appendChild(opt);
        }
        modelSelect.value = model.id;

        // Show custom input if custom model
        if (model.id === 'custom') {
          customModelWrap.style.display = 'inline';
          customModelInput.focus();
        } else {
          customModelWrap.style.display = 'none';
        }

        updateStats();
        toast(`已切换到 ${model.name}`);
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
}

// Toggle dropdown
modelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  modelDropdown.classList.toggle('show');
  if (modelDropdown.classList.contains('show')) {
    renderModelCategories();
    modelSearch.focus();
  }
});

// Search models
modelSearch.addEventListener('input', (e) => {
  renderModelCategories(e.target.value);
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!modelDropdown.contains(e.target) && e.target !== modelBtn) {
    modelDropdown.classList.remove('show');
  }
});

// Initialize current model display
function updateCurrentModelDisplay() {
  const modelId = config.model || 'gpt-4o';
  let modelName = modelId;

  Object.values(modelData).forEach(category => {
    const found = category.models.find(m => m.id === modelId);
    if (found) modelName = found.name;
  });

  currentModelSpan.textContent = modelName;
}

// ── Init ──
chrome.storage.local.get(['config', 'sessions', 'profiles', 'currentProfile', 'tokenUsage'], (data) => {
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
  if (config.searchEngine === 'custom') {
    customSearchUrlField.style.display = 'block';
  }
  streamToggle.checked = config.streamEnabled ?? true;
  userAvatarInput.value = config.userAvatar ? t('avatarUploaded') : '';
  aiAvatarInput.value = config.aiAvatar ? t('avatarUploaded') : '';

  // Update model display
  config.model = config.model || 'gpt-4o';
  updateCurrentModelDisplay();

  if (config.model === 'custom') {
    customModelWrap.style.display = 'inline';
    customModelInput.value = config.customModel || '';
  }

  if (data.sessions) { sessions = data.sessions; renderHistory(); }
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
    noTitleLabel: t('noTitle')
  });
}

// ── Model ──
function getModel() {
  if (config.model === 'custom') {
    return customModelInput.value.trim() || 'gpt-4o';
  }
  return config.model || 'gpt-4o';
}

// ── Temperature slider ──
tempInput.addEventListener('input', () => { tempVal.textContent = tempInput.value; });
topPInput.addEventListener('input', () => { topPVal.textContent = topPInput.value; });
freqPenaltyInput.addEventListener('input', () => { freqPenaltyVal.textContent = freqPenaltyInput.value; });
presPenaltyInput.addEventListener('input', () => { presPenaltyVal.textContent = presPenaltyInput.value; });

// ── Search engine selector ──
searchEngineSelect.addEventListener('change', () => {
  if (searchEngineSelect.value === 'custom') {
    customSearchUrlField.style.display = 'block';
  } else {
    customSearchUrlField.style.display = 'none';
  }
});

// ── Toast ──
function toast(msg, duration = 1800) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// ── Stats ──
function updateStats() {
  const s = current();
  const msgs = s ? s.messages.length : 0;
  const chars = s ? s.messages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0) : 0;
  document.getElementById('statsMsgs').textContent = `${t('messages')}: ${msgs}`;
  document.getElementById('statsChars').textContent = `${t('characters')}: ${chars}`;
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
  config.streamEnabled = streamToggle.checked;
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
  if (!apiKey) { showTestResult('error', t('pleaseEnterApiKey')); return; }
  testBtn.disabled = true; testBtn.textContent = t('testing');
  showTestResult('info', t('connecting'));
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: getModel(), messages: [{ role: 'user', content: 'hi' }], max_tokens: 5, stream: false })
    });
    const json = await res.json().catch(() => null);
    if (res.ok) showTestResult('ok', `✅ 连接成功！回复: "${json?.choices?.[0]?.message?.content || ''}"\nURL: ${baseUrl}`);
    else showTestResult('error', `❌ 失败: ${json?.error?.message || 'HTTP ' + res.status}\nURL: ${baseUrl}`);
  } catch (err) {
    showTestResult('error', `❌ 网络错误: ${err.message}\nURL: ${baseUrl}`);
  } finally { testBtn.disabled = false; testBtn.textContent = '🔌 测试连接'; }
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
    const role = m.role === 'user' ? '👤 用户' : '🤖 AI';
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
    rm.addEventListener('click', () => { attachments.splice(i, 1); renderAttachments(); });
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
  userInput.placeholder = t('placeholder');
  document.querySelector('.input-hint').textContent = t('inputHint');

  // Update model search
  document.getElementById('modelSearch').placeholder = t('searchPlaceholder');

  // Update welcome screen if visible
  const welcome = document.querySelector('.welcome h2');
  if (welcome) welcome.textContent = t('welcomeTitle');
  const welcomeDesc = document.querySelector('.welcome p');
  if (welcomeDesc) welcomeDesc.textContent = t('welcomeDesc');

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
}
function loadSession(id) {
  currentId = id; renderHistory();
  const s = sessions.find(s => s.id === id);
  if (!s) return;
  topbarTitle.textContent = s.title;
  renderMessages(s.messages); updateStats();
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
function save() { chrome.storage.local.set({ sessions, tokenUsage }); }

let proxyStreaming = false; // true while handling a PROXY_SEND request

// ── Cross-window sync ──
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || streaming || proxyStreaming) return;
  if (!changes.sessions) return;
  const newSessions = changes.sessions.newValue || [];
  const oldCount = (current()?.messages || []).length;
  sessions = newSessions;
  renderHistory();
  const s = current();
  if (!s) return;
  const newCount = s.messages.length;
  if (newCount > oldCount) {
    for (let i = oldCount; i < newCount; i++) {
      addBubbleFromMsg(s.messages[i], i);
    }
    scrollBottom();
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
    historyList.appendChild(div);
  });
}

// ── Markdown ──
function renderMarkdown(text) {
  if (typeof marked === 'undefined') return null;
  const html = marked.parse(text, { breaks: true, gfm: true });
  const div = document.createElement('div');
  div.className = 'bubble md';
  div.innerHTML = html;

  // Make all links open in new tab
  div.querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  div.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    const lang = (code?.className.match(/language-(\w+)/) || [])[1] || '';
    const wrap = document.createElement('div'); wrap.className = 'code-wrap';
    const header = document.createElement('div'); header.className = 'code-header';
    const langLabel = document.createElement('span'); langLabel.className = 'code-lang'; langLabel.textContent = lang;
    const btn = document.createElement('button'); btn.className = 'code-copy'; btn.textContent = t('copy');
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(code?.innerText || pre.innerText).then(() => {
        btn.textContent = t('copiedCheck'); setTimeout(() => btn.textContent = t('copy'), 1500);
      });
    });
    header.appendChild(langLabel); header.appendChild(btn);
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(header); wrap.appendChild(pre);
  });
  return div;
}

// ── Render messages ──
function renderMessages(messages) {
  messagesEl.innerHTML = '';
  if (!messages.length) {
    messagesEl.innerHTML = `<div class="welcome"><div class="welcome-icon">✦</div><h2>${t('welcomeTitle')}</h2><p>${t('welcomeDesc')}</p><div class="shortcuts"><div class="shortcut"><kbd>Ctrl</kbd>+<kbd>N</kbd> ${t('shortcutNew')}</div><div class="shortcut"><kbd>Ctrl</kbd>+<kbd>/</kbd> ${t('shortcutFocus')}</div><div class="shortcut"><kbd>Ctrl</kbd>+<kbd>E</kbd> ${t('shortcutExport')}</div></div></div>`;
    return;
  }
  messages.forEach((m, i) => addBubbleFromMsg(m, i));
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

function addBubbleFromMsg(m, idx) {
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
  const actions = document.createElement('div'); actions.className = 'msg-actions';
  actions.appendChild(makeActBtn(t('copy'), () => { navigator.clipboard.writeText(getPlainText(m.content)).then(() => toast(t('copied'))); }));
  if (m.role === 'assistant') actions.appendChild(makeActBtn(t('regenerate'), () => regenerate(idx)));
  if (m.role === 'user') actions.appendChild(makeActBtn(t('editResend'), () => editAndResend(idx)));
  actions.appendChild(makeActBtn(t('deleteBtn'), () => deleteMessage(idx), true));

  wrap.appendChild(bubble); wrap.appendChild(time); wrap.appendChild(actions);
  row.appendChild(av); row.appendChild(wrap);
  messagesEl.appendChild(row);
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
  const av = document.createElement('div'); av.className = 'avatar ai'; av.textContent = '✦';
  const bubble = document.createElement('div'); bubble.className = 'error-msg'; bubble.textContent = '⚠ ' + msg;
  row.appendChild(av); row.appendChild(bubble);
  messagesEl.appendChild(row); scrollBottom();
}
function showTyping() {
  const row = document.createElement('div'); row.className = 'msg-row ai'; row.id = 'typing';
  const av = document.createElement('div'); av.className = 'avatar ai'; av.textContent = '✦';
  const bubble = document.createElement('div'); bubble.className = 'bubble typing-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  row.appendChild(av); row.appendChild(bubble);
  messagesEl.appendChild(row); scrollBottom();
}
function removeTyping() { const el = document.getElementById('typing'); if (el) el.remove(); }

function toApiContent(content) {
  return EasyChatCore.toApiContent(content);
}

// ── Send ──
async function send() {
  if (streaming) return;
  const text = userInput.value.trim();
  if (!text && !attachments.length) return;
  if (!config.apiKey) { overlay.classList.add('show'); return; }
  if (!currentId) newChat();
  const s = current();
  const w = messagesEl.querySelector('.welcome');
  if (w) w.remove();

  const userMsg = EasyChatCore.createUserMessage({
    text,
    imageUrls: attachments.filter(a => a.type === 'image').map(a => `data:${a.mimeType};base64,${a.base64}`),
    fileAttachments: attachments.filter(a => a.type === 'file').map(a => ({ name: a.name, text: a.text })),
    meta: EasyChatCore.buildMessageMeta({
      imageAttachments: attachments.filter(a => a.type === 'image').map(a => ({
        kind: 'image',
        label: a.name || '图片',
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
  if (s.messages.length === 1) { s.title = (text || attachments[0]?.name || t('newChat')).slice(0, 28); topbarTitle.textContent = s.title; }
  addBubbleFromMsg(userMsg, s.messages.length - 1);
  userInput.value = ''; userInput.style.height = 'auto';
  attachments = []; renderAttachments();
  save(); renderHistory(); updateStats(); autoScroll = true;

  // Web search if enabled (do it after displaying user message)
  let searchResult = null;
  if (webSearchEnabled && text) {
    showTyping(); // Show typing indicator during search
    searchResult = await tavilySearch(text);
    removeTyping();
  }

  await doRequest(s, searchResult);
}

async function doRequest(s, searchResult = null) {
  streaming = true; sendBtn.style.display = 'none'; stopBtn.style.display = 'flex';
  if (!searchResult) showTyping(); // Only show typing if not already shown
  abortController = new AbortController();

  const baseUrl = EasyChatCore.normalizeBaseUrl(config.baseUrl);
  const model = getModel();

  // Build messages with context limit
  let msgs = s.messages.map(m => ({ role: m.role, content: toApiContent(m.content) }));
  if (config.contextLimit) msgs = msgs.slice(-parseInt(config.contextLimit));

  EasyChatCore.appendSearchResultToLastUserMessage(msgs, searchResult, '联网搜索结果');

  // Prepend system prompt
  const formatInstruction = 'Always format your responses using Markdown: use ## or ### for section headings, **bold** for key terms, bullet points or numbered lists for enumerations, and ``` code blocks ``` for any code. Structure longer answers with clear headings and sections.';
  const sysContent = EasyChatCore.buildSystemMessage(config.systemPrompt, formatInstruction, formatInstruction);
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
      const content = data.choices?.[0]?.message?.content || '';

      // Record token usage
      if (data.usage) {
        recordTokenUsage(model, data.usage);
      }

      const aiMsg = EasyChatCore.createAssistantMessage({ content, time: Date.now() });
      s.messages.push(aiMsg);
      save(); updateStats();
      addBubbleFromMsg(aiMsg, s.messages.length - 1);
      scrollBottom();
      return;
    }

    // Streaming mode with real-time markdown rendering
    const row = document.createElement('div'); row.className = 'msg-row ai';
    const av = document.createElement('div'); av.className = 'avatar ai';
    if (config.aiAvatar) {
      const img = document.createElement('img');
      img.src = config.aiAvatar;
      av.appendChild(img);
    } else {
      av.textContent = '🤖';
    }
    const wrap = document.createElement('div'); wrap.className = 'bubble-wrap';
    const bubble = document.createElement('div'); bubble.className = 'bubble md';
    wrap.appendChild(bubble); row.appendChild(av); row.appendChild(wrap);
    messagesEl.appendChild(row);

    let lastRenderTime = 0;
    const RENDER_INTERVAL = 100; // Render markdown every 100ms
    removeTyping();
    const { full, usage: usageData } = await EasyChatCore.streamChatCompletion({
      baseUrl,
      apiKey: config.apiKey,
      body,
      signal: abortController.signal,
      onChunk: ({ delta, full }) => {
        const now = Date.now();
        if (now - lastRenderTime > RENDER_INTERVAL) {
          const mdBubble = renderMarkdown(full);
          if (mdBubble) {
            bubble.innerHTML = mdBubble.innerHTML;
          } else {
            bubble.textContent = full;
          }
          lastRenderTime = now;
          if (delta) chrome.runtime.sendMessage({ type: 'CHAT_CHUNK', full, sessionId: s.id }).catch(() => {});
        }
        scrollBottom();
      }
    });

    // Final render
    const mdBubble = renderMarkdown(full);
    if (mdBubble) {
      bubble.innerHTML = mdBubble.innerHTML;
    } else {
      bubble.textContent = full;
    }

    // Record token usage if available
    if (usageData) {
      recordTokenUsage(model, usageData);
    }

    const aiMsg = EasyChatCore.createAssistantMessage({ content: full, time: Date.now() });
    const idx = s.messages.length;
    s.messages.push(aiMsg); save(); updateStats();
    // Notify popup that streaming is done
    chrome.runtime.sendMessage({ type: 'CHAT_DONE', full, sessionId: s.id }).catch(() => {});

    // Time + actions
    const time = document.createElement('div'); time.className = 'msg-time';
    time.textContent = new Date(aiMsg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const actions = document.createElement('div'); actions.className = 'msg-actions';
    actions.appendChild(makeActBtn(t('copy'), () => { navigator.clipboard.writeText(full).then(() => toast(t('copied'))); }));
    actions.appendChild(makeActBtn(t('regenerate'), () => regenerate(idx)));
    actions.appendChild(makeActBtn(t('deleteBtn'), () => deleteMessage(idx), true));
    wrap.appendChild(time); wrap.appendChild(actions);

  } catch (err) {
    removeTyping();
    if (err.name !== 'AbortError') addErrorBubble(err.message);
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
  if (config.searchEngine === 'custom') {
    customSearchUrlField.style.display = 'block';
  }
  streamToggle.checked = config.streamEnabled ?? true;
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

  if (msg.type !== 'PROXY_SEND') return false;

  const { sessionId, messages, searchResult, cfg } = msg;

  // Sync session into local state
  let s = sessions.find(s => s.id === sessionId);
  if (!s) {
    s = { id: sessionId, title: messages[0]?.content?.slice?.(0, 28) || 'Chat', messages: [], createdAt: Date.now() };
    sessions.unshift(s);
  }
  s.messages = messages;

  // Switch to this session in UI
  const isCurrentSession = currentId === sessionId;
  if (!isCurrentSession) {
    currentId = sessionId;
    chrome.storage.local.set({ currentId });
    renderHistory();
    renderMessages(s.messages);
    topbarTitle.textContent = s.title || t('newChat');
  }

  // Merge config overrides (apiKey, model, etc from popup profile)
  const savedConfig = { ...config };
  Object.assign(config, cfg);

  // Create a live AI bubble in the main UI for streaming updates
  const proxyAiRow = document.createElement('div');
  proxyAiRow.className = 'msg-row ai';
  const proxyAv = document.createElement('div');
  proxyAv.className = 'avatar ai';
  if (config.aiAvatar) {
    const img = document.createElement('img'); img.src = config.aiAvatar; proxyAv.appendChild(img);
  } else { proxyAv.textContent = '🤖'; }
  const proxyWrap = document.createElement('div'); proxyWrap.className = 'bubble-wrap';
  const proxyBubble = document.createElement('div'); proxyBubble.className = 'bubble';
  proxyBubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  proxyWrap.appendChild(proxyBubble);
  proxyAiRow.appendChild(proxyAv); proxyAiRow.appendChild(proxyWrap);
  messagesEl.appendChild(proxyAiRow);
  scrollBottom();

  // Run the request, streaming chunks back to popup via background
  (async () => {
    proxyStreaming = true;
    const baseUrl = EasyChatCore.normalizeBaseUrl(config.baseUrl);
    const model = getModel();

    let apiMsgs = s.messages.map(m => ({ role: m.role, content: toApiContent(m.content) }));
    if (config.contextLimit) apiMsgs = apiMsgs.slice(-parseInt(config.contextLimit));

    EasyChatCore.appendSearchResultToLastUserMessage(apiMsgs, searchResult, '联网搜索结果');

    const formatInstruction = 'Always format your responses using Markdown.';
    const sysContent = EasyChatCore.buildSystemMessage(config.systemPrompt, formatInstruction, formatInstruction);
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

    let lastRender = 0;
    try {
      const { full } = await EasyChatCore.streamChatCompletion({
        baseUrl,
        apiKey: config.apiKey,
        body,
        onChunk: ({ delta, full }) => {
          if (!delta) return;
          chrome.runtime.sendMessage({ type: 'PROXY_CHUNK', delta, full });
          const now = Date.now();
          if (now - lastRender > 80) {
            const rendered = renderMarkdown(full);
            if (rendered) {
              proxyBubble.className = rendered.className;
              proxyBubble.innerHTML = rendered.innerHTML;
            } else {
              proxyBubble.textContent = full;
            }
            lastRender = now;
            scrollBottom();
          }
        }
      });

      // Final render of the completed response
      const rendered = renderMarkdown(full);
      if (rendered) {
        proxyBubble.className = rendered.className;
        proxyBubble.innerHTML = rendered.innerHTML;
      } else {
        proxyBubble.textContent = full;
      }
      scrollBottom();

      // Save AI response into session
      const aiMsg = EasyChatCore.createAssistantMessage({ content: full, time: Date.now() });
      s.messages.push(aiMsg);
      save();
      renderHistory();
      updateStats();

      chrome.runtime.sendMessage({ type: 'PROXY_DONE', full, sessionId });
    } catch (e) {
      proxyBubble.textContent = '错误: ' + e.message;
      chrome.runtime.sendMessage({ type: 'PROXY_ERROR', error: e.message });
    } finally {
      proxyStreaming = false;
      Object.assign(config, savedConfig);
    }
  })();

  sendResponse({ ok: true });
  return true;
});
