// background.js - service worker

// Open or focus the popup window when the extension icon is clicked
let popupWindowId = null;
let chatWindowId = null;
let lastNormalWindowId = null;
let chatHostWindowId = null;
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

async function openOrFocusChatWindow(sourceWindowId) {
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
      return { ok: true, reused: true, windowId: chatWindowId };
    } catch {
      chatWindowId = null;
    }
  }

  const url = chrome.runtime.getURL(`chat.html${chatHostWindowId ? `?sourceWindowId=${chatHostWindowId}` : ''}`);
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: 1200,
    height: 800,
  });
  chatWindowId = win?.id ?? null;
  return { ok: true, reused: false, windowId: chatWindowId };
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
    openOrFocusChatWindow(msg.sourceWindowId).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err?.message || 'open_chat_failed' });
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
