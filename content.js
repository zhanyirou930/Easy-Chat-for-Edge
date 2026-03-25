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

  // ── Message listener ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_SELECTION') {
      sendResponse({ text: window.getSelection().toString().trim() });
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
    }
  });

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
