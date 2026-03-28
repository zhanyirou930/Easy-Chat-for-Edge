// content.js - injected into all pages

(function () {
  if (window.__easychat_content_loaded) return;
  window.__easychat_content_loaded = true;

  // ── Annotation bubble state ──
  let annotationBubbles = [];
  let annotationsVisible = false;

  // ── Region select state ──
  let selectOverlay = null;
  let selectCallback = null;
  let lastSelectionRange = null;
  let lastFocusedEditable = null;
  let selectionAskBar = null;
  let selectionAskTooltip = null;
  let selectionAskRaf = 0;
  let selectionAskShowTimer = 0;
  let selectionAskText = '';
  let inlineTranslateBubble = null;
  let inlineTranslateBubbleContent = null;
  let inlineTranslateBubbleLabel = null;
  let inlineTranslateBubbleAnchor = null;
  let inlineTranslateRefreshRaf = 0;
  let inlineTranslateBubbleOffset = { dx: 0, dy: 0 };
  let sourceHighlightOverlay = null;
  let sourceHighlightDismissBtn = null;
  let sourceHighlightState = null;
  let sourceHighlightRefreshRaf = 0;
  let sourceHighlightTimer = 0;
  let sourceHighlightKeyHandler = null;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const INLINE_TRANSLATE_MAX_CHARS = 120;
  const INLINE_TRANSLATE_MAX_LINES = 3;
  const SELECTION_ACTIONS = [
    { action: 'ask', label: '问 AI' },
    { action: 'rewrite', label: '改写' },
    { action: 'translate', label: '翻译' },
    { action: 'summarize_selection', label: '总结' }
  ];

  document.addEventListener('selectionchange', () => {
    rememberSelection();
    queueSelectionAskBarUpdate();
  }, true);
  document.addEventListener('mouseup', queueSelectionAskBarUpdate, true);
  document.addEventListener('keyup', queueSelectionAskBarUpdate, true);
  document.addEventListener('mousedown', (e) => {
    if (!selectionAskBar?.contains(e.target)) hideSelectionAskBar();
  }, true);
  document.addEventListener('focusin', (e) => {
    const editable = getEditableElement(e.target);
    if (editable) lastFocusedEditable = editable;
  }, true);
  window.addEventListener('scroll', hideSelectionAskBar, true);
  window.addEventListener('resize', hideSelectionAskBar, true);
  window.addEventListener('scroll', scheduleInlineTranslateBubbleRefresh, true);
  window.addEventListener('resize', scheduleInlineTranslateBubbleRefresh, true);
  window.addEventListener('scroll', scheduleSourceHighlightRefresh, true);
  window.addEventListener('resize', scheduleSourceHighlightRefresh, true);

  // ── Message listener ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_SELECTION') {
      const info = getCurrentSelectionInfo();
      sendResponse({ text: info.text, editable: info.editable });
    } else if (msg.type === 'GET_PAGE_TEXT') {
      sendResponse({ text: getPageText() });
    } else if (msg.type === 'START_REGION_SELECT') {
      startRegionSelect((rect) => {
        sendResponse({ rect });
      });
      return true; // async
    } else if (msg.type === 'SET_ANNOTATIONS') {
      setAnnotations(msg.annotations);
      sendResponse({ ok: true });
    } else if (msg.type === 'CLEAR_ANNOTATIONS') {
      clearAnnotations();
      sendResponse({ ok: true });
    } else if (msg.type === 'TOGGLE_ANNOTATIONS') {
      toggleAnnotations();
      sendResponse({ visible: annotationsVisible });
    } else if (msg.type === 'APPLY_ASSISTANT_TEXT') {
      sendResponse(applyAssistantText(msg.text || ''));
    } else if (msg.type === 'HIGHLIGHT_CONTEXT_SOURCE') {
      highlightContextSource(msg.source || {}).then(sendResponse);
      return true;
    }
  });

  function isTextInput(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return ['text', 'search', 'url', 'email', 'tel', 'password', 'number'].includes(type);
  }

  function isEditableElement(el) {
    return !!el && (isTextInput(el) || el.isContentEditable);
  }

  function getEditableElement(node) {
    let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.documentElement) {
      if (isEditableElement(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function isInsideOverlayUi(node) {
    const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return !!(
      el && (
        selectionAskBar?.contains(el) ||
        selectionAskTooltip?.contains(el) ||
        inlineTranslateBubble?.contains(el)
      )
    );
  }

  function rememberSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!range) return;
    if (isInsideOverlayUi(range.commonAncestorContainer)) return;
    lastSelectionRange = range.cloneRange();
    const editable = getEditableElement(range.commonAncestorContainer);
    if (editable) lastFocusedEditable = editable;
  }

  function getCurrentSelectedText() {
    const active = document.activeElement;
    if (isTextInput(active)) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      if (end > start) return active.value.slice(start, end).trim();
    }
    const sel = window.getSelection();
    if (sel?.rangeCount && isInsideOverlayUi(sel.getRangeAt(0).commonAncestorContainer)) return '';
    return window.getSelection().toString().trim();
  }

  function isCurrentSelectionEditable() {
    const active = document.activeElement;
    if (isTextInput(active)) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      return end > start;
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range || range.collapsed) return false;
    if (isInsideOverlayUi(range.commonAncestorContainer)) return false;
    return !!getEditableElement(range.commonAncestorContainer);
  }

  function getCurrentSelectionInfo() {
    return {
      text: getCurrentSelectedText(),
      editable: isCurrentSelectionEditable()
    };
  }

  function getCurrentSelectionRect() {
    const active = document.activeElement;
    if (isTextInput(active)) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      if (end > start) return active.getBoundingClientRect();
    }
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (isInsideOverlayUi(range.commonAncestorContainer)) return null;
    const rect = range.getBoundingClientRect();
    if (rect?.width || rect?.height) return rect;
    const firstRect = range.getClientRects?.()[0];
    return firstRect || null;
  }

  function shouldUseInlineTranslate(text) {
    const value = String(text || '').trim();
    if (!value) return false;
    const lines = value.split(/\n+/).filter(Boolean).length;
    return value.length <= INLINE_TRANSLATE_MAX_CHARS && lines <= INLINE_TRANSLATE_MAX_LINES;
  }

  function cloneSelectionAnchor() {
    const active = document.activeElement;
    if (isTextInput(active)) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      if (end > start) {
        return {
          getRect: () => active.isConnected ? active.getBoundingClientRect() : null
        };
      }
    }

    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0).cloneRange();
      return {
        getRect: () => {
          const rect = range.getBoundingClientRect();
          if (rect?.width || rect?.height) return rect;
          const firstRect = range.getClientRects?.()[0];
          return firstRect || null;
        }
      };
    }

    if (lastSelectionRange) {
      const range = lastSelectionRange.cloneRange();
      return {
        getRect: () => {
          const rect = range.getBoundingClientRect();
          if (rect?.width || rect?.height) return rect;
          const firstRect = range.getClientRects?.()[0];
          return firstRect || null;
        }
      };
    }

    const rect = getCurrentSelectionRect();
    if (!rect) return null;
    return { getRect: () => rect };
  }

  function queueSelectionAskBarUpdate() {
    if (selectionAskRaf) cancelAnimationFrame(selectionAskRaf);
    if (selectionAskShowTimer) clearTimeout(selectionAskShowTimer);
    selectionAskRaf = requestAnimationFrame(() => {
      selectionAskRaf = 0;
      if (isMacPlatform()) {
        selectionAskShowTimer = setTimeout(() => {
          selectionAskShowTimer = 0;
          updateSelectionAskBar();
        }, 180);
      } else {
        updateSelectionAskBar();
      }
    });
  }

  function isMacPlatform() {
    const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
    return /mac/i.test(platform);
  }

  function isDarkAppearance() {
    return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function getToolbarPalette() {
    if (isDarkAppearance()) {
      return {
        barBorder: 'rgba(255,255,255,0.14)',
        barBg: 'linear-gradient(180deg, rgba(142,149,160,0.26), rgba(96,102,112,0.18) 48%, rgba(64,68,76,0.22))',
        barShadow: '0 12px 26px rgba(0,0,0,0.18), 0 2px 5px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.02)',
        sheen: 'linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02))',
        separator: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.18), rgba(255,255,255,0.03))',
        buttonColor: 'rgba(255,255,255,0.9)',
        buttonHoverBg: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))',
        buttonHoverBorder: 'rgba(255,255,255,0.12)',
        buttonHoverShadow: '0 4px 10px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.08)',
        tooltipBg: 'linear-gradient(180deg, rgba(36,39,45,0.94), rgba(20,22,26,0.9))',
        tooltipBorder: 'rgba(255,255,255,0.14)',
        tooltipColor: '#f7fffd',
        tooltipShadow: '0 8px 24px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.08)'
      };
    }

    return {
      barBorder: 'rgba(255,255,255,0.42)',
      barBg: 'linear-gradient(180deg, rgba(253,254,255,0.68), rgba(244,246,250,0.54) 48%, rgba(232,236,242,0.48))',
      barShadow: '0 14px 28px rgba(90,96,108,0.12), 0 2px 5px rgba(90,96,108,0.06), inset 0 1px 0 rgba(255,255,255,0.66), inset 0 -1px 0 rgba(255,255,255,0.1)',
      sheen: 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.06))',
      separator: 'linear-gradient(180deg, rgba(111,118,130,0.03), rgba(111,118,130,0.16), rgba(111,118,130,0.03))',
      buttonColor: 'rgba(51,56,66,0.86)',
      buttonHoverBg: 'linear-gradient(180deg, rgba(255,255,255,0.44), rgba(255,255,255,0.16))',
      buttonHoverBorder: 'rgba(255,255,255,0.36)',
      buttonHoverShadow: '0 3px 10px rgba(111,118,130,0.1), inset 0 1px 0 rgba(255,255,255,0.54)',
      tooltipBg: 'linear-gradient(180deg, rgba(250,251,253,0.96), rgba(236,240,245,0.92))',
      tooltipBorder: 'rgba(255,255,255,0.5)',
      tooltipColor: 'rgba(46,51,60,0.88)',
      tooltipShadow: '0 8px 24px rgba(90,96,108,0.1), inset 0 1px 0 rgba(255,255,255,0.5)'
    };
  }

  function createToolbarIcon(action) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.display = 'block';
    svg.style.overflow = 'visible';

    const add = (tag, attrs) => {
      const el = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      svg.appendChild(el);
      return el;
    };

    const stroke = {
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    };

    if (action === 'ask') {
      add('path', { ...stroke, d: 'M4.5 5.5h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-3 2v-2H4.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z' });
      add('circle', { cx: '7', cy: '9.5', r: '.7', fill: 'currentColor', stroke: 'none' });
      add('circle', { cx: '9', cy: '9.5', r: '.7', fill: 'currentColor', stroke: 'none' });
      add('circle', { cx: '11', cy: '9.5', r: '.7', fill: 'currentColor', stroke: 'none' });
      return svg;
    }

    if (action === 'rewrite') {
      add('path', { ...stroke, d: 'M5 12.8 4 15l2.3-.8 6.8-6.8-1.5-1.5L5 12.8Z' });
      add('path', { ...stroke, d: 'm10.9 4.8 1.5-1.5a1.2 1.2 0 0 1 1.7 0l.6.6a1.2 1.2 0 0 1 0 1.7L13.2 7' });
      return svg;
    }

    if (action === 'translate') {
      add('path', { ...stroke, d: 'M4 5.2h6' });
      add('path', { ...stroke, d: 'M7 3.5v1.7c0 2-1.4 4.1-3.6 5.4' });
      add('path', { ...stroke, d: 'M5.2 8.2c.7.8 1.6 1.5 2.6 2.1' });
      add('path', { ...stroke, d: 'M11.4 12.7 13.8 6l2.4 6.7' });
      add('path', { ...stroke, d: 'M12.2 10.8H15.4' });
      return svg;
    }

    add('path', { ...stroke, d: 'M4.5 5.2h9' });
    add('path', { ...stroke, d: 'M4.5 9h9' });
    add('path', { ...stroke, d: 'M4.5 12.8h6.2' });
    add('path', { ...stroke, d: 'M12.8 12.1 14 13.3l2-2.1' });
    return svg;
  }

  function ensureSelectionAskBar() {
    if (selectionAskBar) return selectionAskBar;
    const palette = getToolbarPalette();
    selectionAskBar = document.createElement('div');
    Object.assign(selectionAskBar.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      gap: '0',
      padding: '3px 5px',
      borderRadius: '13px',
      border: `1px solid ${palette.barBorder}`,
      background: palette.barBg,
      color: palette.buttonColor,
      boxShadow: palette.barShadow,
      backdropFilter: 'blur(28px) saturate(165%) brightness(1.03)',
      WebkitBackdropFilter: 'blur(28px) saturate(165%) brightness(1.03)',
      overflow: 'hidden',
      isolation: 'isolate'
    });
    selectionAskBar.addEventListener('mousedown', (e) => e.preventDefault());

    const sheen = document.createElement('div');
    Object.assign(sheen.style, {
      position: 'absolute',
      inset: '1px 1px auto 1px',
      height: '44%',
      borderRadius: '12px 12px 10px 10px',
      background: palette.sheen,
      pointerEvents: 'none',
      opacity: '.95'
    });
    selectionAskBar.appendChild(sheen);

    SELECTION_ACTIONS.forEach((item, idx) => {
      if (idx > 0) {
        const separator = document.createElement('div');
        Object.assign(separator.style, {
          width: '1px',
          height: '19px',
          background: palette.separator,
          margin: '0 2px',
          position: 'relative',
          zIndex: '1'
        });
        selectionAskBar.appendChild(separator);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.action = item.action;
      btn.title = item.label;
      btn.setAttribute('aria-label', item.label);
      Object.assign(btn.style, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '26px',
        height: '26px',
        padding: '0',
        borderRadius: '8px',
        border: '1px solid transparent',
        background: 'transparent',
        color: palette.buttonColor,
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        boxShadow: 'none',
        transition: 'transform 120ms ease, background 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
        position: 'relative',
        zIndex: '1'
      });

      const icon = createToolbarIcon(item.action);
      btn.appendChild(icon);

      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('mouseenter', () => {
        btn.style.background = palette.buttonHoverBg;
        btn.style.borderColor = palette.buttonHoverBorder;
        btn.style.transform = 'translateY(-0.5px)';
        btn.style.boxShadow = palette.buttonHoverShadow;
        showSelectionTooltip(btn, item.label);
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.borderColor = 'transparent';
        btn.style.transform = '';
        btn.style.boxShadow = 'none';
        hideSelectionTooltip();
      });
      btn.addEventListener('focus', () => showSelectionTooltip(btn, item.label));
      btn.addEventListener('blur', hideSelectionTooltip);
      btn.addEventListener('click', (e) => runSelectionAction(e, item.action));
      selectionAskBar.appendChild(btn);
    });

    document.documentElement.appendChild(selectionAskBar);
    return selectionAskBar;
  }

  function ensureSelectionAskTooltip() {
    if (selectionAskTooltip) return selectionAskTooltip;
    const palette = getToolbarPalette();
    selectionAskTooltip = document.createElement('div');
    Object.assign(selectionAskTooltip.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'none',
      padding: '5px 9px',
      borderRadius: '9px',
      border: `1px solid ${palette.tooltipBorder}`,
      background: palette.tooltipBg,
      color: palette.tooltipColor,
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '.01em',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      boxShadow: palette.tooltipShadow,
      backdropFilter: 'blur(18px) saturate(140%)',
      WebkitBackdropFilter: 'blur(18px) saturate(140%)'
    });
    document.documentElement.appendChild(selectionAskTooltip);
    return selectionAskTooltip;
  }

  function showSelectionTooltip(btn, text) {
    const tooltip = ensureSelectionAskTooltip();
    tooltip.textContent = text;
    tooltip.style.display = 'block';
      const rect = btn.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tipRect.width / 2, window.innerWidth - tipRect.width - 8));
      const top = Math.max(8, rect.top - tipRect.height - 8);
      tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideSelectionTooltip() {
    if (selectionAskTooltip) selectionAskTooltip.style.display = 'none';
  }

  function ensureInlineTranslateBubble() {
    if (inlineTranslateBubble) return inlineTranslateBubble;
    const palette = getToolbarPalette();
    inlineTranslateBubble = document.createElement('div');
    Object.assign(inlineTranslateBubble.style, {
      position: 'fixed',
      zIndex: '2147483645',
      display: 'none',
      maxWidth: '320px',
      minWidth: '180px',
      padding: '10px 12px 12px',
      borderRadius: '14px',
      border: `1px solid ${palette.tooltipBorder}`,
      background: palette.tooltipBg,
      color: palette.tooltipColor,
      boxShadow: palette.tooltipShadow,
      backdropFilter: 'blur(20px) saturate(150%)',
      WebkitBackdropFilter: 'blur(20px) saturate(150%)'
    });

    const head = document.createElement('div');
    Object.assign(head.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      marginBottom: '8px',
      cursor: 'move',
      userSelect: 'none'
    });

    inlineTranslateBubbleLabel = document.createElement('div');
    Object.assign(inlineTranslateBubbleLabel.style, {
      fontSize: '11px',
      fontWeight: '700',
      color: '#10a37f',
      letterSpacing: '.02em'
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
      border: 'none',
      background: 'transparent',
      color: palette.buttonColor,
      fontSize: '16px',
      lineHeight: '1',
      cursor: 'pointer',
      padding: '0',
      margin: '0'
    });
    closeBtn.addEventListener('click', () => clearInlineTranslateBubble());

    inlineTranslateBubbleContent = document.createElement('div');
    Object.assign(inlineTranslateBubbleContent.style, {
      fontSize: '13px',
      lineHeight: '1.6',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      userSelect: 'text'
    });

    head.appendChild(inlineTranslateBubbleLabel);
    head.appendChild(closeBtn);
    inlineTranslateBubble.appendChild(head);
    inlineTranslateBubble.appendChild(inlineTranslateBubbleContent);
    document.documentElement.appendChild(inlineTranslateBubble);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    head.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      inlineTranslateBubbleOffset.dx += e.clientX - lastX;
      inlineTranslateBubbleOffset.dy += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      positionInlineTranslateBubble();
    });
    document.addEventListener('mouseup', () => {
      dragging = false;
    });

    return inlineTranslateBubble;
  }

  function positionInlineTranslateBubble() {
    if (!inlineTranslateBubble || !inlineTranslateBubbleAnchor?.getRect) return;
    const rect = inlineTranslateBubbleAnchor.getRect();
    if (!rect) return;
    const bubbleRect = inlineTranslateBubble.getBoundingClientRect();
    const gap = 10;
    let left = rect.right + gap;
    if (left + bubbleRect.width > window.innerWidth - 8) {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - bubbleRect.width - 8));
    }
    const belowTop = rect.bottom + gap;
    const aboveTop = rect.top - bubbleRect.height - gap;
    const top = belowTop + bubbleRect.height <= window.innerHeight - 8
      ? belowTop
      : Math.max(8, aboveTop);
    left = Math.max(8, Math.min(left + inlineTranslateBubbleOffset.dx, window.innerWidth - bubbleRect.width - 8));
    const maxTop = Math.max(8, window.innerHeight - bubbleRect.height - 8);
    const nextTop = Math.max(8, Math.min(top + inlineTranslateBubbleOffset.dy, maxTop));
    inlineTranslateBubble.style.left = `${left}px`;
    inlineTranslateBubble.style.top = `${nextTop}px`;
  }

  function scheduleInlineTranslateBubbleRefresh() {
    if (!inlineTranslateBubble || inlineTranslateBubble.style.display === 'none') return;
    if (inlineTranslateRefreshRaf) cancelAnimationFrame(inlineTranslateRefreshRaf);
    inlineTranslateRefreshRaf = requestAnimationFrame(() => {
      inlineTranslateRefreshRaf = 0;
      positionInlineTranslateBubble();
    });
  }

  function clearInlineTranslateBubble() {
    if (inlineTranslateRefreshRaf) {
      cancelAnimationFrame(inlineTranslateRefreshRaf);
      inlineTranslateRefreshRaf = 0;
    }
    inlineTranslateBubbleAnchor = null;
    inlineTranslateBubbleOffset = { dx: 0, dy: 0 };
    if (inlineTranslateBubble) inlineTranslateBubble.style.display = 'none';
  }

  function showInlineTranslateBubble(anchor, label, text, error) {
    const bubble = ensureInlineTranslateBubble();
    if (anchor && anchor !== inlineTranslateBubbleAnchor) {
      inlineTranslateBubbleOffset = { dx: 0, dy: 0 };
    }
    inlineTranslateBubbleAnchor = anchor || inlineTranslateBubbleAnchor;
    inlineTranslateBubbleLabel.textContent = label;
    inlineTranslateBubbleLabel.style.color = error ? '#ef4444' : '#10a37f';
    inlineTranslateBubbleContent.textContent = text;
    inlineTranslateBubble.style.display = 'block';
    positionInlineTranslateBubble();
  }

  async function runSelectionAction(e, action) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const text = selectionAskText || getCurrentSelectedText();
    if (!text) {
      hideSelectionAskBar();
      return;
    }
    const selectionInfo = getCurrentSelectionInfo();
    const useInlineTranslate = action === 'translate' && shouldUseInlineTranslate(text);
    const translateAnchor = useInlineTranslate ? cloneSelectionAnchor() : null;

    hideSelectionTooltip();
    selectionAskBar.style.opacity = '0.72';
    selectionAskBar.style.pointerEvents = 'none';

    if (useInlineTranslate && translateAnchor) {
      showInlineTranslateBubble(translateAnchor, '翻译中...', '正在生成译文...');
      const resp = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'TRANSLATE_SELECTION_INLINE',
          text
        }, (response) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(response);
        });
      });
      selectionAskBar.style.opacity = '1';
      selectionAskBar.style.pointerEvents = '';
      hideSelectionAskBar();
      window.getSelection()?.removeAllRanges?.();
      if (resp?.ok) {
        const label = resp.targetLanguage ? `翻译 · ${resp.targetLanguage}` : '翻译';
        showInlineTranslateBubble(translateAnchor, label, resp.translation || '');
      } else {
        showInlineTranslateBubble(translateAnchor, '翻译失败', resp?.message || '翻译请求失败', true);
      }
      return;
    }

    const resp = await new Promise(resolve => {
      chrome.runtime.sendMessage({
        type: 'OPEN_SELECTION_ACTION',
        payload: {
          action,
          text,
          editable: selectionInfo.editable,
          url: location.href,
          title: document.title
        }
      }, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response);
      });
    });
    selectionAskBar.style.opacity = '1';
    selectionAskBar.style.pointerEvents = '';
    if (resp?.ok) {
      hideSelectionAskBar();
      window.getSelection()?.removeAllRanges?.();
    }
  }

  function hideSelectionAskBar() {
    if (selectionAskBar) {
      selectionAskBar.style.display = 'none';
      selectionAskBar.style.pointerEvents = '';
      selectionAskBar.style.opacity = '1';
    }
    hideSelectionTooltip();
  }

  function updateSelectionAskBar() {
    const text = getCurrentSelectedText();
    const rect = getCurrentSelectionRect();
    if (!text || !rect) {
      hideSelectionAskBar();
      return;
    }
    selectionAskText = text;
    const bar = ensureSelectionAskBar();
    bar.style.display = 'flex';

    const barRect = bar.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - barRect.width / 2, window.innerWidth - barRect.width - 8));
    const belowTop = Math.min(window.innerHeight - barRect.height - 8, rect.bottom + 8);
    const aboveTop = Math.max(8, rect.top - barRect.height - 10);
    const top = isMacPlatform()
      ? belowTop
      : (rect.top - barRect.height - 10 >= 8 ? aboveTop : belowTop);
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  }

  function dispatchInputEvent(el, text) {
    try {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      }));
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function buildTextFragment(text) {
    const frag = document.createDocumentFragment();
    String(text).split('\n').forEach((line, idx) => {
      if (idx > 0) frag.appendChild(document.createElement('br'));
      if (line) frag.appendChild(document.createTextNode(line));
    });
    return frag;
  }

  function getActiveEditable() {
    const active = getEditableElement(document.activeElement);
    if (active) return active;
    if (lastFocusedEditable?.isConnected) return lastFocusedEditable;
    return null;
  }

  function getEditableRange(editable) {
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const current = sel.getRangeAt(0);
      if (getEditableElement(current.commonAncestorContainer) === editable) {
        return current.cloneRange();
      }
    }

    if (lastSelectionRange && getEditableElement(lastSelectionRange.commonAncestorContainer) === editable) {
      return lastSelectionRange.cloneRange();
    }

    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    return range;
  }

  function applyToTextInput(input, text) {
    if (input.disabled || input.readOnly) {
      return { ok: false, error: 'input_read_only' };
    }

    input.focus();
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    input.setRangeText(text, start, end, 'end');
    dispatchInputEvent(input, text);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      ok: true,
      mode: start !== end ? 'replace_selection' : 'insert_cursor',
      target: input.tagName.toLowerCase()
    };
  }

  function applyToContentEditable(editable, text) {
    editable.focus();
    const selection = window.getSelection();
    const range = getEditableRange(editable);
    const hadSelection = !range.collapsed;
    range.deleteContents();
    const frag = buildTextFragment(text);
    const lastNode = frag.lastChild;
    range.insertNode(frag);

    if (lastNode) {
      const afterRange = document.createRange();
      afterRange.setStartAfter(lastNode);
      afterRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(afterRange);
      lastSelectionRange = afterRange.cloneRange();
    }

    dispatchInputEvent(editable, text);
    return {
      ok: true,
      mode: hadSelection ? 'replace_selection' : 'insert_cursor',
      target: 'contenteditable'
    };
  }

  function applyAssistantText(text) {
    if (!String(text || '').trim()) {
      return { ok: false, error: 'empty_text' };
    }

    const editable = getActiveEditable();
    if (editable) {
      return isTextInput(editable)
        ? applyToTextInput(editable, text)
        : applyToContentEditable(editable, text);
    }

    if (lastSelectionRange) {
      const selectedEditable = getEditableElement(lastSelectionRange.commonAncestorContainer);
      if (selectedEditable) {
        lastFocusedEditable = selectedEditable;
        return isTextInput(selectedEditable)
          ? applyToTextInput(selectedEditable, text)
          : applyToContentEditable(selectedEditable, text);
      }
      return { ok: false, error: 'selection_not_editable' };
    }

    return { ok: false, error: 'no_editable_target' };
  }

  function normalizeSearchText(text, options) {
    const opts = options || {};
    const raw = String(text || '');
    let normalized = '';
    const map = [];
    let lastWasSpace = true;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const isSpace = /\s/.test(ch);
      const isLooseSeparator = !!opts.ignorePunctuation && /[\p{P}\p{S}]/u.test(ch);
      if (isSpace || isLooseSeparator) {
        if (!lastWasSpace && normalized) {
          normalized += ' ';
          map.push(i);
          lastWasSpace = true;
        }
        continue;
      }

      normalized += ch.toLowerCase();
      map.push(i);
      lastWasSpace = false;
    }

    if (normalized.endsWith(' ')) {
      normalized = normalized.slice(0, -1);
      map.pop();
    }

    return { normalized, map };
  }

  function getRawRangeFromNormalizedMatch(map, startIndex, matchLength) {
    if (!map.length || startIndex < 0 || matchLength <= 0) return null;
    const rawStart = map[startIndex];
    const lastIndex = startIndex + matchLength - 1;
    const rawEnd = (map[lastIndex] ?? rawStart) + 1;
    return { rawStart, rawEnd };
  }

  function dedupeStrings(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      const value = String(item || '').replace(/\s+/g, ' ').trim();
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(item => String(item || '').replace(/\s+/g, ' ').trim());
  }

  function buildSearchFragments(text) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return [];

    const fragments = raw
      .split(/[\r\n]+|[。！？!?；;：:]/)
      .map(part => part.replace(/\s+/g, ' ').trim())
      .filter(part => part.length >= 8);

    if (raw.length >= 24) fragments.unshift(raw.slice(0, Math.min(raw.length, 96)).trim());
    if (raw.length >= 14) fragments.unshift(raw.slice(0, Math.min(raw.length, 56)).trim());

    return dedupeStrings(fragments).slice(0, 8);
  }

  function buildSourceSearchPlans(source) {
    const preview = String(source?.preview || '').trim();
    const title = String(source?.title || '').trim();
    const candidates = [
      { query: preview, kind: 'preview' },
      { query: title, kind: 'title' },
      ...buildSearchFragments(preview).map(query => ({ query, kind: 'preview' })),
      ...buildSearchFragments(title).map(query => ({ query, kind: 'title' }))
    ];
    const plans = [];
    const seen = new Set();

    const pushPlan = (candidate, options) => {
      const opts = options || {};
      const query = candidate?.query || '';
      const normalized = normalizeSearchText(query, opts).normalized;
      if (!normalized || normalized.length < (opts.minLength || 3)) return;
      const key = JSON.stringify([candidate?.kind || '', normalized, !!opts.ignorePunctuation, opts.minLength || 0]);
      if (seen.has(key)) return;
      seen.add(key);
      plans.push({ query, kind: candidate?.kind || 'preview', options: opts });
    };

    candidates.forEach(candidate => pushPlan(candidate, { minLength: 3 }));
    candidates.forEach(candidate => pushPlan(candidate, { minLength: 4, ignorePunctuation: true }));
    return plans;
  }

  function clearSourceHighlight() {
    if (sourceHighlightTimer) {
      clearTimeout(sourceHighlightTimer);
      sourceHighlightTimer = 0;
    }
    if (sourceHighlightRefreshRaf) {
      cancelAnimationFrame(sourceHighlightRefreshRaf);
      sourceHighlightRefreshRaf = 0;
    }
    if (sourceHighlightKeyHandler) {
      document.removeEventListener('keydown', sourceHighlightKeyHandler, true);
      sourceHighlightKeyHandler = null;
    }
    sourceHighlightState = null;
    sourceHighlightDismissBtn = null;
    if (sourceHighlightOverlay) {
      sourceHighlightOverlay.remove();
      sourceHighlightOverlay = null;
    }
  }

  function ensureSourceHighlightOverlay() {
    if (sourceHighlightOverlay) return sourceHighlightOverlay;
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483645',
      pointerEvents: 'none'
    });

    sourceHighlightDismissBtn = document.createElement('button');
    sourceHighlightDismissBtn.type = 'button';
    sourceHighlightDismissBtn.textContent = '×';
    sourceHighlightDismissBtn.title = '关闭定位';
    Object.assign(sourceHighlightDismissBtn.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      width: '32px',
      height: '32px',
      borderRadius: '999px',
      border: '1px solid rgba(16,163,127,0.4)',
      background: 'rgba(15,23,42,0.72)',
      color: '#d8fff4',
      fontSize: '18px',
      lineHeight: '1',
      cursor: 'pointer',
      pointerEvents: 'auto',
      boxShadow: '0 10px 24px rgba(0,0,0,0.18)'
    });
    sourceHighlightDismissBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearSourceHighlight();
    });
    overlay.appendChild(sourceHighlightDismissBtn);

    document.documentElement.appendChild(overlay);
    sourceHighlightOverlay = overlay;
    return overlay;
  }

  function renderSourceHighlightRects(rects) {
    const overlay = ensureSourceHighlightOverlay();
    const visibleRects = (rects || []).filter(rect => rect && rect.width > 1 && rect.height > 1);
    if (!visibleRects.length) {
      overlay.replaceChildren();
      return false;
    }
    overlay.replaceChildren(sourceHighlightDismissBtn);

    visibleRects.forEach(rect => {
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed',
        left: `${Math.max(0, rect.left - 3)}px`,
        top: `${Math.max(0, rect.top - 3)}px`,
        width: `${rect.width + 6}px`,
        height: `${rect.height + 6}px`,
        borderRadius: '8px',
        background: 'rgba(16,163,127,0.18)',
        boxShadow: '0 0 0 2px rgba(16,163,127,0.55), 0 0 0 6px rgba(16,163,127,0.12)'
      });
      overlay.appendChild(box);
    });

    return true;
  }

  function refreshSourceHighlight() {
    const rects = sourceHighlightState?.getRects?.();
    if (!rects) return false;
    return renderSourceHighlightRects(rects);
  }

  function scheduleSourceHighlightRefresh() {
    if (!sourceHighlightState?.getRects || sourceHighlightRefreshRaf) return;
    sourceHighlightRefreshRaf = requestAnimationFrame(() => {
      sourceHighlightRefreshRaf = 0;
      refreshSourceHighlight();
    });
  }

  function drawSourceHighlight(getRects) {
    clearSourceHighlight();
    if (typeof getRects !== 'function') return false;
    sourceHighlightState = { getRects };
    sourceHighlightKeyHandler = (e) => {
      if (e.key === 'Escape') clearSourceHighlight();
    };
    document.addEventListener('keydown', sourceHighlightKeyHandler, true);
    const drawn = refreshSourceHighlight();
    sourceHighlightTimer = window.setTimeout(clearSourceHighlight, 3600);
    return drawn;
  }

  function waitForAnimationFrames(count) {
    return new Promise(resolve => {
      const step = (remaining) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count || 1);
    });
  }

  function scrollRectIntoView(rect) {
    if (!rect) return;
    const targetTop = Math.max(0, window.scrollY + rect.top - Math.max(120, Math.round(window.innerHeight * 0.28)));
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  }

  function getSearchableTextNodes() {
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.textContent || '';
        if (!text.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        if (!parent.getClientRects().length) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }

  function buildTextNodeSearchIndex(options) {
    const nodes = getSearchableTextNodes();
    if (!nodes.length) return null;

    let rawText = '';
    const segments = nodes.map(node => {
      const text = node.textContent || '';
      const segment = { node, text, start: rawText.length, end: rawText.length + text.length };
      rawText += text;
      return segment;
    });

    const haystack = normalizeSearchText(rawText, options);
    return { segments, normalized: haystack.normalized, map: haystack.map };
  }

  function buildInputSearchIndexes(options) {
    return Array.from(document.querySelectorAll('textarea,input'))
      .filter(isTextInput)
      .map(input => {
        const value = input.value || '';
        if (!value.trim()) return null;
        const haystack = normalizeSearchText(value, options);
        return { input, normalized: haystack.normalized, map: haystack.map };
      })
      .filter(Boolean);
  }

  function pointFromRawIndex(segments, rawIndex, preferEnd) {
    for (const segment of segments) {
      if (rawIndex < segment.end || (preferEnd && rawIndex === segment.end)) {
        const offset = Math.max(0, Math.min(rawIndex - segment.start, segment.text.length));
        return { node: segment.node, offset };
      }
    }

    const last = segments[segments.length - 1];
    return last
      ? { node: last.node, offset: last.text.length }
      : null;
  }

  function findPreviewInTextNodes(preview, options, searchIndex) {
    const opts = options || {};
    const minLength = opts.minLength || 3;
    const needle = normalizeSearchText(preview, opts).normalized;
    if (!needle || needle.length < minLength) return null;

    const index = searchIndex || buildTextNodeSearchIndex(opts);
    if (!index?.normalized) return null;

    const matchIndex = index.normalized.indexOf(needle);
    if (matchIndex === -1) return null;

    const rawRange = getRawRangeFromNormalizedMatch(index.map, matchIndex, needle.length);
    if (!rawRange) return null;

    const start = pointFromRawIndex(index.segments, rawRange.rawStart, false);
    const end = pointFromRawIndex(index.segments, rawRange.rawEnd, true);
    if (!start?.node || !end?.node) return null;

    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return { range };
  }

  function findPreviewInInputs(preview, options, searchIndexes) {
    const opts = options || {};
    const minLength = opts.minLength || 3;
    const needle = normalizeSearchText(preview, opts).normalized;
    if (!needle || needle.length < minLength) return null;

    const indexes = searchIndexes || buildInputSearchIndexes(opts);
    for (const entry of indexes) {
      const matchIndex = entry.normalized.indexOf(needle);
      if (matchIndex === -1) continue;

      const rawRange = getRawRangeFromNormalizedMatch(entry.map, matchIndex, needle.length);
      if (!rawRange) continue;
      return { input: entry.input, rawStart: rawRange.rawStart, rawEnd: rawRange.rawEnd };
    }

    return null;
  }

  async function highlightContextSource(source) {
    const plans = buildSourceSearchPlans(source);
    if (!plans.length) return { ok: false, error: 'empty_query' };

    const searchIndexes = {
      exact: {
        inputs: buildInputSearchIndexes({ minLength: 3 }),
        text: buildTextNodeSearchIndex({ minLength: 3 })
      },
      loose: {
        inputs: buildInputSearchIndexes({ minLength: 4, ignorePunctuation: true }),
        text: buildTextNodeSearchIndex({ minLength: 4, ignorePunctuation: true })
      }
    };

    for (const plan of plans) {
      const bucket = plan.options?.ignorePunctuation ? searchIndexes.loose : searchIndexes.exact;
      const inputMatch = findPreviewInInputs(plan.query, plan.options, bucket.inputs);
      if (inputMatch?.input) {
        inputMatch.input.focus({ preventScroll: true });
        inputMatch.input.scrollIntoView({ block: 'center', behavior: 'smooth' });
        try {
          inputMatch.input.setSelectionRange(inputMatch.rawStart, inputMatch.rawEnd);
        } catch {}
        await waitForAnimationFrames(2);
        const drawn = drawSourceHighlight(() => [inputMatch.input.getBoundingClientRect()]);
        return drawn
          ? { ok: true, mode: 'input', matchedQuery: plan.query, matchedKind: plan.kind, loose: !!plan.options?.ignorePunctuation }
          : { ok: false, error: 'highlight_failed' };
      }

      const textMatch = findPreviewInTextNodes(plan.query, plan.options, bucket.text);
      if (!textMatch?.range) continue;

      const firstRect = textMatch.range.getBoundingClientRect();
      scrollRectIntoView(firstRect);
      await waitForAnimationFrames(2);
      const drawn = drawSourceHighlight(() => {
        const rects = Array.from(textMatch.range.getClientRects());
        return rects.length ? rects : [textMatch.range.getBoundingClientRect()];
      });
      return drawn
        ? { ok: true, mode: 'text', matchedQuery: plan.query, matchedKind: plan.kind, loose: !!plan.options?.ignorePunctuation }
        : { ok: false, error: 'highlight_failed' };
    }

    return { ok: false, error: 'text_not_found' };
  }

  // ── Get readable page text ──
  function getPageText() {
    const clone = document.body.cloneNode(true);
    // Remove scripts, styles, nav, footer, ads
    ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript'].forEach(tag => {
      clone.querySelectorAll(tag).forEach(el => el.remove());
    });
    const text = clone.innerText || clone.textContent || '';
    // Collapse whitespace, limit to 8000 chars
    return text.replace(/\s{3,}/g, '\n\n').trim().slice(0, 8000);
  }

  // ── Region select overlay ──
  function startRegionSelect(callback) {
    if (selectOverlay) return;

    selectOverlay = document.createElement('div');
    Object.assign(selectOverlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647',
      cursor: 'crosshair', background: 'rgba(0,0,0,0.35)'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'absolute', border: '2px solid #10a37f',
      background: 'rgba(16,163,127,0.1)', display: 'none',
      pointerEvents: 'none'
    });
    selectOverlay.appendChild(box);

    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
      background: '#1e1e1e', color: '#ececec', padding: '6px 16px',
      borderRadius: '20px', fontSize: '13px', pointerEvents: 'none',
      border: '1px solid #2e2e2e', zIndex: '2147483647'
    });
    hint.textContent = '拖拽选择截图区域  ·  Esc 取消';
    selectOverlay.appendChild(hint);

    let startX, startY, dragging = false;

    selectOverlay.addEventListener('mousedown', (e) => {
      startX = e.clientX; startY = e.clientY; dragging = true;
      box.style.display = 'block';
      box.style.left = startX + 'px'; box.style.top = startY + 'px';
      box.style.width = '0'; box.style.height = '0';
    });

    selectOverlay.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.min(e.clientX, startX), y = Math.min(e.clientY, startY);
      const w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    });

    selectOverlay.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const rect = {
        x: Math.min(e.clientX, startX),
        y: Math.min(e.clientY, startY),
        w: Math.abs(e.clientX - startX),
        h: Math.abs(e.clientY - startY)
      };
      cleanup();
      if (rect.w > 10 && rect.h > 10) {
        // Send to background for storage (popup may already be closed)
        chrome.runtime.sendMessage({ type: 'REGION_SELECTED', rect });
        callback(rect);
      } else {
        callback(null);
      }
    });

    document.addEventListener('keydown', onEsc);
    function onEsc(e) {
      if (e.key === 'Escape') { cleanup(); callback(null); }
    }

    function cleanup() {
      selectOverlay.remove(); selectOverlay = null;
      document.removeEventListener('keydown', onEsc);
    }

    document.body.appendChild(selectOverlay);
  }

  // ── Annotation bubbles ──
  let rafId = null;

  function startRaf() {
    if (rafId) return;
    function loop() {
      annotationBubbles.forEach(({ bubble, highlight, getOffset }) => {
        if (!highlight.isConnected) return;
        const r = highlight.getBoundingClientRect();
        const { dx, dy } = getOffset();
        bubble.style.left = Math.max(0, Math.min(r.left + dx, window.innerWidth - 280)) + 'px';
        bubble.style.top  = (r.top + dy) + 'px';
      });
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopRaf() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function setAnnotations(annotations) {
    clearAnnotations();
    if (!annotations || !annotations.length) return;

    annotations.forEach((ann, i) => {
      const target = findTextNode(ann.text);
      if (!target) return;

      const bubble = document.createElement('div');
      bubble.className = '__easychat_bubble';
      Object.assign(bubble.style, {
        position: 'fixed', zIndex: '2147483640',
        background: '#1e1e1e', color: '#ececec',
        border: '1px solid #10a37f', borderRadius: '8px',
        padding: '8px 12px', fontSize: '12px', lineHeight: '1.5',
        maxWidth: '260px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        cursor: 'move', userSelect: 'none'
      });

      const label = document.createElement('div');
      label.style.cssText = 'font-weight:600;color:#10a37f;margin-bottom:4px;font-size:11px;';
      label.textContent = `📌 注释 ${i + 1}`;

      const content = document.createElement('div');
      content.textContent = ann.comment;

      const closeBtn = document.createElement('button');
      Object.assign(closeBtn.style, {
        position: 'absolute', top: '4px', right: '6px',
        background: 'none', border: 'none', color: '#666',
        cursor: 'pointer', fontSize: '14px', lineHeight: '1', padding: '0'
      });
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => bubble.remove());

      bubble.appendChild(label);
      bubble.appendChild(content);
      bubble.appendChild(closeBtn);

      try {
        const range = target.range;
        const highlight = document.createElement('mark');
        highlight.className = '__easychat_highlight';
        Object.assign(highlight.style, {
          background: 'rgba(16,163,127,0.25)', borderRadius: '2px',
          outline: '1px solid rgba(16,163,127,0.5)'
        });
        range.surroundContents(highlight);
        document.body.appendChild(bubble);

        // offset relative to highlight top-left (in client coords)
        let dx = 0, dy = highlight.getBoundingClientRect().height + 6;

        // ── Drag ──
        let lastX = 0, lastY = 0, dragging = false;
        bubble.addEventListener('mousedown', (e) => {
          if (e.target === closeBtn) return;
          dragging = true;
          lastX = e.clientX; lastY = e.clientY;
          e.preventDefault();
        });
        const onMove = (e) => {
          if (!dragging) return;
          dx += e.clientX - lastX;
          dy += e.clientY - lastY;
          lastX = e.clientX; lastY = e.clientY;
        };
        const onUp = () => { dragging = false; };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);

        annotationBubbles.push({ bubble, highlight, getOffset: () => ({ dx, dy }), onMove, onUp });
      } catch (e) {
        // surroundContents can fail on cross-node ranges; skip
      }
    });

    annotationsVisible = true;
    startRaf();
  }

  function findTextNode(searchText) {
    if (!searchText || searchText.length < 4) return null;
    const needle = searchText.trim().slice(0, 60);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.textContent.indexOf(needle);
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + needle.length);
        return { range };
      }
    }
    return null;
  }

  function clearAnnotations() {
    stopRaf();
    annotationBubbles.forEach(({ bubble, highlight, onMove, onUp, onScroll }) => {
      bubble.remove();
      if (onMove)   document.removeEventListener('mousemove', onMove);
      if (onUp)     document.removeEventListener('mouseup', onUp);
      if (onScroll) window.removeEventListener('scroll', onScroll);
      // Unwrap highlight
      if (highlight && highlight.parentNode) {
        const parent = highlight.parentNode;
        while (highlight.firstChild) parent.insertBefore(highlight.firstChild, highlight);
        highlight.remove();
      }
    });
    annotationBubbles = [];
    annotationsVisible = false;
  }

  function toggleAnnotations() {
    if (annotationsVisible) {
      annotationBubbles.forEach(({ bubble }) => { bubble.style.display = 'none'; });
      annotationsVisible = false;
    } else {
      annotationBubbles.forEach(({ bubble }) => { bubble.style.display = ''; });
      annotationsVisible = true;
    }
  }

})();
