(function (global) {
  const DISPLAY_TAG_ICONS = ['💻', '✏️', '📄', '📌'];

  function previewText(text, maxLen) {
    return (text || '').replace(/\s+/g, ' ').trim().slice(0, maxLen || 120);
  }

  function compactObject(obj) {
    const out = {};
    Object.entries(obj || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value) && value.length === 0) return;
      if (value === '') return;
      out[key] = value;
    });
    return out;
  }

  function normalizeBaseUrl(baseUrl) {
    let normalized = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    if (!normalized.endsWith('/v1')) normalized += '/v1';
    return normalized;
  }

  function toApiContent(content) {
    if (typeof content === 'string') return content;
    return (content || []).filter(part => part.type !== 'file_text');
  }

  function extractPlainText(content) {
    if (typeof content === 'string') return content;
    return (content || [])
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }

  function buildDisplayText(options) {
    const opts = options || {};
    if (opts.context) {
      const prefix = `${opts.context.icon} ${opts.context.label}`;
      return opts.userText ? `${prefix}  ${opts.userText}` : prefix;
    }
    if (opts.webSearchEnabled && opts.userText) {
      return `🌐 ${opts.userText}`;
    }
    return opts.userText || '';
  }

  function parseDisplayText(display) {
    if (!display) return null;
    const iconMatch = DISPLAY_TAG_ICONS.find(icon => display.startsWith(icon));
    if (!iconMatch) return { tagged: false, label: '', text: display };
    const sepIdx = display.indexOf('  ');
    return {
      tagged: true,
      label: sepIdx !== -1 ? display.slice(0, sepIdx) : display,
      text: sepIdx !== -1 ? display.slice(sepIdx + 2) : ''
    };
  }

  function buildUserContent(options) {
    const opts = options || {};
    const text = opts.text || '';
    const imageUrls = opts.imageUrls || [];
    const fileAttachments = opts.fileAttachments || [];

    if (!imageUrls.length && !fileAttachments.length) return text;

    const parts = [];
    if (text) parts.push({ type: 'text', text });

    imageUrls.forEach(url => {
      parts.push({ type: 'image_url', image_url: { url } });
    });

    fileAttachments.forEach(file => {
      parts.push({ type: 'text', text: `\n\n[文件: ${file.name}]\n\`\`\`\n${file.text}\n\`\`\`` });
      parts.push({ type: 'file_text', name: file.name });
    });

    return parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts;
  }

  function createContextSource(kind, data) {
    return compactObject({ kind, ...(data || {}) });
  }

  function buildContextSources(options) {
    const opts = options || {};
    const sources = [];

    (opts.sources || []).forEach(source => {
      if (source) sources.push(source);
    });

    (opts.imageAttachments || []).forEach(image => {
      sources.push(createContextSource(image.kind || 'image', {
        label: image.label || image.name || '图片',
        name: image.name,
        mimeType: image.mimeType
      }));
    });

    (opts.fileAttachments || []).forEach(file => {
      sources.push(createContextSource('file', {
        label: file.name || '文件',
        name: file.name,
        chars: file.chars || file.text?.length || 0,
        preview: previewText(file.preview || file.text || '')
      }));
    });

    if (opts.webSearchEnabled) {
      sources.push(createContextSource('web_search', {
        label: opts.webSearchLabel || '联网搜索'
      }));
    }

    return sources;
  }

  function buildMessageMeta(options) {
    const opts = options || {};
    return compactObject({
      contextAction: opts.contextAction,
      contextLabel: opts.contextLabel,
      contextSources: buildContextSources(opts),
      requestedWebSearch: opts.webSearchEnabled || undefined
    });
  }

  function createUserMessage(options) {
    const opts = options || {};
    const message = {
      role: 'user',
      content: buildUserContent({
        text: opts.text || '',
        imageUrls: opts.imageUrls || [],
        fileAttachments: opts.fileAttachments || []
      }),
      time: opts.time || Date.now()
    };
    if (opts.display) message.display = opts.display;
    if (opts.meta && Object.keys(opts.meta).length) message.meta = opts.meta;
    return message;
  }

  function createAssistantMessage(options) {
    const opts = options || {};
    const message = {
      role: 'assistant',
      content: opts.content || '',
      time: opts.time || Date.now()
    };
    if (opts.display) message.display = opts.display;
    if (opts.meta && Object.keys(opts.meta).length) message.meta = opts.meta;
    return message;
  }

  function appendSearchResultToLastUserMessage(messages, searchResult, label) {
    if (!searchResult || !messages?.length) return messages;
    const prefix = `[${label || '联网搜索结果'}]\n${searchResult}`;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user') return messages;

    if (typeof last.content === 'string') {
      last.content += `\n\n${prefix}`;
      return messages;
    }

    const textPart = last.content.find(part => part.type === 'text');
    if (textPart) textPart.text += `\n\n${prefix}`;
    else last.content.unshift({ type: 'text', text: prefix });
    return messages;
  }

  function buildSystemMessage(systemPrompt, formatInstruction, fallbackSystemPrompt) {
    if (systemPrompt) return `${systemPrompt}\n\n${formatInstruction}`;
    return fallbackSystemPrompt || formatInstruction;
  }

  function buildChatRequestBody(options) {
    const opts = options || {};
    const body = {
      model: opts.model || 'gpt-4o',
      messages: opts.messages || [],
      stream: !!opts.stream,
      temperature: opts.temperature ?? 0.7,
      top_p: opts.topP ?? 1.0,
      frequency_penalty: opts.frequencyPenalty ?? 0.0,
      presence_penalty: opts.presencePenalty ?? 0.0
    };
    if (opts.maxTokens !== undefined && opts.maxTokens !== null && opts.maxTokens !== '') {
      body.max_tokens = parseInt(opts.maxTokens, 10);
    }
    return body;
  }

  async function parseErrorResponse(res) {
    const raw = await res.text();
    let message = `HTTP ${res.status}`;
    try {
      message = JSON.parse(raw).error?.message || message;
    } catch {}
    return message;
  }

  async function fetchChatCompletion(options) {
    const opts = options || {};
    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`
      },
      body: JSON.stringify(opts.body),
      signal: opts.signal
    });
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res));
    }
    return res;
  }

  async function requestChatCompletionJson(options) {
    const res = await fetchChatCompletion(options);
    return await res.json();
  }

  async function streamChatCompletion(options) {
    const opts = options || {};
    const res = await fetchChatCompletion(options);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let full = '';
    let usage = null;

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
          if (json.usage) usage = json.usage;
          if (!delta && !json.usage) continue;
          full += delta;
          if (typeof opts.onChunk === 'function') {
            opts.onChunk({ delta, full, json, usage });
          }
        } catch {}
      }
    }

    return { full, usage };
  }

  async function executeSearch(query, config, options) {
    const opts = options || {};
    const engine = config?.searchEngine || 'tavily';
    const key = config?.searchApiKey;
    const labels = {
      referenceSource: opts.referenceSourceLabel || '参考来源：',
      searchResults: opts.searchResultsLabel || '搜索结果：',
      noTitle: opts.noTitleLabel || '无标题'
    };

    if (!key && engine !== 'custom') {
      if (typeof opts.onMissingKey === 'function') opts.onMissingKey();
      return null;
    }

    try {
      switch (engine) {
        case 'tavily':
          return await searchTavily(query, key, labels);
        case 'serper':
          return await searchSerper(query, key, labels);
        case 'serpapi':
          return await searchSerpApi(query, key, labels);
        case 'bing':
          return await searchBing(query, key, labels);
        case 'brave':
          return await searchBrave(query, key, labels);
        case 'custom':
          return await searchCustom(query, config?.customSearchUrl, key, labels);
        default:
          return null;
      }
    } catch (err) {
      console.error('[EasyChatCore] search failed:', err);
      return null;
    }
  }

  async function searchTavily(query, key, labels) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        search_depth: 'basic',
        include_answer: true
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = '';
    if (data.answer) text += `搜索摘要：${data.answer}\n\n`;
    if (data.results?.length) {
      text += `${labels.referenceSource}\n`;
      data.results.forEach((item, idx) => {
        text += `${idx + 1}. [${item.title}](${item.url})\n${item.content?.slice(0, 300)}...\n\n`;
      });
    }
    return text || null;
  }

  async function searchSerper(query, key, labels) {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = `${labels.searchResults}\n`;
    data.organic?.forEach((item, idx) => {
      text += `${idx + 1}. [${item.title}](${item.link})\n${item.snippet}\n\n`;
    });
    return text || null;
  }

  async function searchSerpApi(query, key, labels) {
    const res = await fetch(`https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${key}&num=5`);
    if (!res.ok) return null;
    const data = await res.json();
    let text = `${labels.searchResults}\n`;
    data.organic_results?.forEach((item, idx) => {
      text += `${idx + 1}. [${item.title}](${item.link})\n${item.snippet}\n\n`;
    });
    return text || null;
  }

  async function searchBing(query, key, labels) {
    const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { 'Ocp-Apim-Subscription-Key': key }
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = `${labels.searchResults}\n`;
    data.webPages?.value?.forEach((item, idx) => {
      text += `${idx + 1}. [${item.name}](${item.url})\n${item.snippet}\n\n`;
    });
    return text || null;
  }

  async function searchBrave(query, key, labels) {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { 'X-Subscription-Token': key }
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = `${labels.searchResults}\n`;
    data.web?.results?.forEach((item, idx) => {
      text += `${idx + 1}. [${item.title}](${item.url})\n${item.description}\n\n`;
    });
    return text || null;
  }

  async function searchCustom(query, customSearchUrl, key, labels) {
    if (!customSearchUrl) return null;
    const finalUrl = customSearchUrl.replace('{query}', encodeURIComponent(query));
    const res = await fetch(finalUrl, {
      headers: key ? { 'Authorization': `Bearer ${key}` } : {}
    });
    if (!res.ok) return null;

    const data = await res.json();
    let text = `${labels.searchResults}\n`;
    const items = Array.isArray(data?.results) ? data.results
      : Array.isArray(data?.items) ? data.items
      : Array.isArray(data) ? data
      : null;

    if (!items) {
      text += JSON.stringify(data, null, 2);
      return text;
    }

    items.slice(0, 5).forEach((item, idx) => {
      const title = item.title || item.name || labels.noTitle;
      const url = item.url || item.link || '';
      const snippet = item.snippet || item.description || item.content || '';
      text += `${idx + 1}. [${title}](${url})\n${snippet.slice(0, 200)}\n\n`;
    });
    return text || null;
  }

  global.EasyChatCore = {
    DISPLAY_TAG_ICONS,
    previewText,
    normalizeBaseUrl,
    toApiContent,
    extractPlainText,
    buildDisplayText,
    parseDisplayText,
    buildUserContent,
    createContextSource,
    buildContextSources,
    buildMessageMeta,
    createUserMessage,
    createAssistantMessage,
    appendSearchResultToLastUserMessage,
    buildSystemMessage,
    buildChatRequestBody,
    parseErrorResponse,
    fetchChatCompletion,
    requestChatCompletionJson,
    streamChatCompletion,
    executeSearch
  };
})(window);
