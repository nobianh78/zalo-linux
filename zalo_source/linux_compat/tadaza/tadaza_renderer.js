(function () {
  'use strict';

  if (window.__TADAZA_INITIALIZED__) return;
  window.__TADAZA_INITIALIZED__ = true;

  console.log('[TADaZa] Initializing TADaZa Extension in Renderer...');

  // Fallback bridge if not exposed via contextBridge
  const bridge = window.tadazaBridge || {
    getConfig: async () => {
      try {
        const raw = localStorage.getItem('tadaza_config');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    saveConfig: async (cfg) => {
      try {
        localStorage.setItem('tadaza_config', JSON.stringify(cfg));
      } catch (e) {}
      return cfg;
    },
    translate: async ({ text, targetLang }) => {
      return { success: false, error: 'Bridge not available' };
    },
    chooseWallpaper: async () => ({ canceled: true }),
    copyImage: async () => ({ success: false }),
    openExternal: async (url) => {
      try { window.open(url, '_blank'); return { success: true }; } catch (e) { return { success: false }; }
    },
    onConfigChanged: () => {}
  };

  let currentConfig = {
    theme: {
      mode: 'system',
      deep_dark: true,
      font_family: 'Default',
      font_size: 14,
      wallpaper: '',
      wallpaper_opacity: 0.85,
      wallpaper_blur: 0
    },
    privacy: {
      anti_peeping: false,
      blur_messages: true,
      blur_media: true,
      blur_names: false,
      hide_typing: false,
      hide_seen: false,
      hide_delivered: false
    },
    translate: {
      enabled: true,
      target_lang: 'vi',
      show_button_on_hover: true
    },
    markdown: {
      enabled: true,
      code_highlight: true,
      auto_format_inline: true,
      code_theme: 'dracula'
    },
    quick_parser: {
      enabled: true,
      auto_detect_bank: true,
      auto_detect_tracking: true,
      auto_detect_phone: true,
      default_qr_template: 'compact2'
    },
    _systemIsDark: false
  };

  const FONT_OPTIONS = [
    { label: 'Mặc định Zalo', value: 'Default' },
    { label: 'Inter (Khuyên dùng)', value: "'Inter', sans-serif" },
    { label: 'Be Vietnam Pro', value: "'Be Vietnam Pro', sans-serif" },
    { label: 'Roboto', value: "'Roboto', sans-serif" },
    { label: 'Open Sans', value: "'Open Sans', sans-serif" },
    { label: 'Fira Code (Code/Mono)', value: "'Fira Code', monospace" }
  ];

  const LANG_OPTIONS = [
    { label: 'Tiếng Việt', code: 'vi' },
    { label: 'Tiếng Anh (English)', code: 'en' },
    { label: 'Tiếng Trung (Giản thể)', code: 'zh-CN' },
    { label: 'Tiếng Nhật (Japanese)', code: 'ja' },
    { label: 'Tiếng Hàn (Korean)', code: 'ko' },
    { label: 'Tiếng Pháp (French)', code: 'fr' },
    { label: 'Tiếng Đức (German)', code: 'de' }
  ];

  const SUPPORTED_LANGS = [
    { id: 'javascript', name: 'JavaScript / Node.js' },
    { id: 'typescript', name: 'TypeScript' },
    { id: 'python', name: 'Python' },
    { id: 'html', name: 'HTML / XML' },
    { id: 'css', name: 'CSS / SCSS' },
    { id: 'json', name: 'JSON' },
    { id: 'c', name: 'C / C++' },
    { id: 'csharp', name: 'C#' },
    { id: 'java', name: 'Java' },
    { id: 'go', name: 'Go (Golang)' },
    { id: 'rust', name: 'Rust' },
    { id: 'php', name: 'PHP' },
    { id: 'sql', name: 'SQL' },
    { id: 'bash', name: 'Bash / Shell' },
    { id: 'markdown', name: 'Markdown' }
  ];

  /* --------------------------------------------------------------------------
     1. Network Hooks for Privacy (Typing, Seen, Delivered)
     -------------------------------------------------------------------------- */
  function setupNetworkHooks() {
    if (window.__TADAZA_NETWORK_HOOKED__) return;
    window.__TADAZA_NETWORK_HOOKED__ = true;

    function checkUrlBlock(url) {
      if (!url || typeof url !== 'string') return null;
      if (currentConfig.privacy && currentConfig.privacy.hide_typing && /\/api\/(message|group)\/typing(?:\?|\/|#|$)/i.test(url)) {
        return 'typing';
      }
      if (currentConfig.privacy && currentConfig.privacy.hide_seen && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:seen|seenv2|react_seen)(?:\?|\/|#|$)/i.test(url)) {
        return 'seen';
      }
      if (currentConfig.privacy && currentConfig.privacy.hide_delivered && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:delivered|deliveredv2|react_delivered)(?:\?|\/|#|$)/i.test(url)) {
        return 'delivered';
      }
      return null;
    }

    // 1. Intercept XMLHttpRequest (Zalo uses Axios / Toxo wrapping XMLHttpRequest)
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        this._tadazaUrl = (url && typeof url.toString === 'function') ? url.toString() : String(url || '');
        this._tadazaMethod = method;
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const blockedReason = checkUrlBlock(this._tadazaUrl);
      if (blockedReason) {
        console.log(`[TADaZa Privacy] Blocked XHR (${blockedReason}):`, this._tadazaUrl);

        const mockPayload = JSON.stringify({
          error_code: 0,
          data: { ok: true },
          message: 'Success'
        });

        try {
          Object.defineProperty(this, 'readyState', { value: 4, writable: true, configurable: true });
          Object.defineProperty(this, 'status', { value: 200, writable: true, configurable: true });
          Object.defineProperty(this, 'statusText', { value: 'OK', writable: true, configurable: true });
          Object.defineProperty(this, 'responseText', { value: mockPayload, writable: true, configurable: true });
          Object.defineProperty(this, 'response', { value: mockPayload, writable: true, configurable: true });
          Object.defineProperty(this, 'responseURL', { value: this._tadazaUrl, writable: true, configurable: true });
        } catch (e) {
          this.readyState = 4;
          this.status = 200;
          this.statusText = 'OK';
          this.responseText = mockPayload;
          this.response = mockPayload;
        }

        this.getAllResponseHeaders = function () {
          return 'content-type: application/json; charset=utf-8\r\n';
        };
        this.getResponseHeader = function (header) {
          if (header && header.toLowerCase() === 'content-type') {
            return 'application/json; charset=utf-8';
          }
          return null;
        };

        setTimeout(() => {
          try {
            const readyEvt = new Event('readystatechange');
            if (typeof this.onreadystatechange === 'function') {
              this.onreadystatechange(readyEvt);
            }
            this.dispatchEvent(readyEvt);
          } catch (e) {}

          try {
            const loadEvt = new ProgressEvent('load');
            if (typeof this.onload === 'function') {
              this.onload(loadEvt);
            }
            this.dispatchEvent(loadEvt);
          } catch (e) {}

          try {
            const loadEndEvt = new ProgressEvent('loadend');
            if (typeof this.onloadend === 'function') {
              this.onloadend(loadEndEvt);
            }
            this.dispatchEvent(loadEndEvt);
          } catch (e) {}
        }, 10);

        return;
      }

      return origSend.apply(this, arguments);
    };

    // 2. Intercept window.fetch
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input && typeof input.url === 'string') {
        url = input.url;
      }
      const blockedReason = checkUrlBlock(url);
      if (blockedReason) {
        console.log(`[TADaZa Privacy] Blocked Fetch (${blockedReason}):`, url);
        return Promise.resolve(new Response(JSON.stringify({ error_code: 0, data: { ok: true } }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return origFetch.apply(this, arguments);
    };

    // 3. Intercept WebSocket send
    const origWsSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      let str = '';
      if (typeof data === 'string') {
        str = data;
      } else if (data instanceof ArrayBuffer) {
        try { str = new TextDecoder().decode(new Uint8Array(data)); } catch (e) {}
      } else if (ArrayBuffer.isView(data)) {
        try { str = new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)); } catch (e) {}
      }

      if (str) {
        if (currentConfig.privacy && currentConfig.privacy.hide_typing && /"typing"|typing_status|is_typing/i.test(str)) {
          console.log('[TADaZa Privacy] Blocked WebSocket typing payload');
          return;
        }
        if (currentConfig.privacy && currentConfig.privacy.hide_seen && /"seen"|ack_seen|read_msg/i.test(str)) {
          console.log('[TADaZa Privacy] Blocked WebSocket seen payload');
          return;
        }
        if (currentConfig.privacy && currentConfig.privacy.hide_delivered && /"delivered"|ack_delivered|recv_msg/i.test(str)) {
          console.log('[TADaZa Privacy] Blocked WebSocket delivered payload');
          return;
        }
      }
      return origWsSend.apply(this, arguments);
    };
  }

  /* --------------------------------------------------------------------------
     2. Apply Configuration to DOM
     -------------------------------------------------------------------------- */
  function applyTheme(cfg) {
    const isDark = cfg.theme.mode === 'dark' || (cfg.theme.mode === 'system' && (cfg._systemIsDark || window.matchMedia('(prefers-color-scheme: dark)').matches));

    if (isDark) {
      document.body.classList.add('dark');
      if (cfg.theme.deep_dark) {
        document.body.classList.add('tadaza-deep-dark');
      } else {
        document.body.classList.remove('tadaza-deep-dark');
      }
      try {
        localStorage.setItem('za_theme', JSON.stringify({ theme: 'dark' }));
      } catch (e) {}
    } else {
      document.body.classList.remove('dark');
      document.body.classList.remove('tadaza-deep-dark');
      try {
        localStorage.setItem('za_theme', JSON.stringify({ theme: 'light' }));
      } catch (e) {}
    }

    // Font family style
    let fontStyle = document.getElementById('tadaza-style-font');
    if (!fontStyle) {
      fontStyle = document.createElement('style');
      fontStyle.id = 'tadaza-style-font';
      document.head.appendChild(fontStyle);
    }
    if (cfg.theme.font_family && cfg.theme.font_family !== 'Default') {
      fontStyle.textContent = `
        body, #app, input, textarea, button, select, [contenteditable="true"] {
          font-family: ${cfg.theme.font_family} !important;
        }
      `;
    } else {
      fontStyle.textContent = '';
    }

    // Font size style
    let sizeStyle = document.getElementById('tadaza-style-fontsize');
    if (!sizeStyle) {
      sizeStyle = document.createElement('style');
      sizeStyle.id = 'tadaza-style-fontsize';
      document.head.appendChild(sizeStyle);
    }
    const fontSize = cfg.theme.font_size || 14;
    if (fontSize !== 14) {
      sizeStyle.textContent = `
        [class*="message-content"], [class*="msg-content"], [class*="bubble-content"] {
          font-size: ${fontSize}px !important;
          line-height: ${Math.round(fontSize * 1.45)}px !important;
        }
      `;
    } else {
      sizeStyle.textContent = '';
    }

    // Wallpaper layer
    updateWallpaper(cfg.theme.wallpaper, cfg.theme.wallpaper_opacity, cfg.theme.wallpaper_blur);

    // Privacy blur classes
    const p = cfg.privacy;
    if (p.anti_peeping && p.blur_messages) {
      document.body.classList.add('tadaza-blur-msg-active');
    } else {
      document.body.classList.remove('tadaza-blur-msg-active');
    }

    if (p.anti_peeping && p.blur_media) {
      document.body.classList.add('tadaza-blur-media-active');
    } else {
      document.body.classList.remove('tadaza-blur-media-active');
    }

    if (p.anti_peeping && p.blur_names) {
      document.body.classList.add('tadaza-blur-names-active');
    } else {
      document.body.classList.remove('tadaza-blur-names-active');
    }


  }

  function updateWallpaper(wallpaperUri, opacity = 0.85, blur = 0) {
    let layer = document.getElementById('tadaza-wallpaper-layer');
    if (!wallpaperUri) {
      if (layer) layer.remove();
      return;
    }

    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'tadaza-wallpaper-layer';
      const chatContainer = document.querySelector('.chat-conversation-history') || document.querySelector('.chat-box') || document.querySelector('.chat-area') || document.body;
      if (chatContainer) {
        if (getComputedStyle(chatContainer).position === 'static') {
          chatContainer.style.position = 'relative';
        }
        chatContainer.insertBefore(layer, chatContainer.firstChild);
      }
    }

    layer.style.backgroundImage = `url("${wallpaperUri}")`;
    layer.style.opacity = opacity;
    layer.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  }

  /* --------------------------------------------------------------------------
     3. Quick In-Place Message Translation (Single Floating Hover Button)
     -------------------------------------------------------------------------- */
  let activeHoverMessage = null;

  function extractMessageText(elem) {
    if (!elem) return '';

    // Clone element to safely query and remove metadata nodes without altering DOM
    const clone = elem.cloneNode(true);

    // Remove metadata elements: timestamp, reaction counters/emojis, action menus, quotes
    const selectorsToRemove = [
      '.card-send-time',
      '.card-send-time__sendTime',
      '[class*="send-time"]',
      '[class*="bubble-message-time"]',
      '[class*="chat-timestamp"]',
      '[class*="message-inner-time"]',
      '[class*="reaction"]',
      '[class*="Reaction"]',
      '.tadaza-trans-box',
      '.tadaza-hover-trans-btn',
      '[class*="chat-message__actions"]',
      '[class*="quick-action"]',
      '[class*="MessageQuoteFragment"]',
      '[class*="message-quote"]',
      'svg'
    ];

    selectorsToRemove.forEach(sel => {
      try {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      } catch (e) {}
    });

    const rawText = (clone.innerText || clone.textContent || '').trim();
    if (!rawText) return '';

    // Filter out leaked reaction shortcuts, timestamps, and emoji codes
    const timeRegex = /^(\d{1,2}:\d{2}(?::\d{2})?(\s*(AM|PM|am|pm|Hôm nay|hôm nay|Hôm qua|hôm qua))?|Hôm nay|Hôm qua)$/i;
    const commonReactionCodes = new Set([
      '/-strong', '/-heart', '/-break', '/-fade', '/-thanks', '/-rose', '/-kiss',
      ':>', ':o', ':O', ':-((', ':-h', ':-H', ':-)', ':-(', ';-)', '<3', ':-*', ':D', ':)', ':('
    ]);

    const lines = rawText.split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (!line) return false;
        if (timeRegex.test(line)) return false;
        if (commonReactionCodes.has(line)) return false;
        if (/^\/-[a-zA-Z0-9_-]+$/.test(line)) return false;
        return true;
      });

    return lines.length > 0 ? lines.join('\n').trim() : rawText;
  }

  function setupMessageTranslator() {
    // Remove any previously spammed buttons from the DOM
    document.querySelectorAll('.tadaza-trans-btn').forEach(btn => btn.remove());

    let hoverBtn = document.getElementById('tadaza-hover-trans-btn');
    if (!hoverBtn) {
      hoverBtn = document.createElement('div');
      hoverBtn.id = 'tadaza-hover-trans-btn';
      hoverBtn.className = 'tadaza-hover-trans-btn';
      hoverBtn.title = 'Dịch tin nhắn này (TADaZa)';
      hoverBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      `;
      document.body.appendChild(hoverBtn);

      hoverBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!activeHoverMessage) return;

        const msgElem = activeHoverMessage;
        const textToTranslate = extractMessageText(msgElem);
        if (!textToTranslate) return;

        const chatMsg = msgElem.closest('.chat-message, [class*="msg-item"], [class*="chat-item"]');
        const oldBox = (chatMsg || msgElem.parentElement).querySelector('.tadaza-trans-box');
        if (oldBox) {
          oldBox.remove();
          return;
        }

        hoverBtn.innerHTML = `
          <svg class="tadaza-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        `;

        try {
          const res = await bridge.translate({
            text: textToTranslate,
            targetLang: currentConfig.translate.target_lang || 'vi'
          });

          hoverBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          `;

          if (res && res.success && res.translated) {
            const box = document.createElement('div');
            box.className = 'tadaza-trans-box';
            box.innerHTML = `
              <div class="trans-header">
                <span>Dịch sang [${res.targetLang || 'vi'}]</span>
                <span style="cursor:pointer; display:flex; align-items:center;" class="trans-close" title="Đóng">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </span>
              </div>
              <div class="trans-body">${escapeHtml(res.translated)}</div>
              <div style="margin-top:6px; font-size:11px; display:flex; gap:12px;">
                <span class="trans-copy" style="cursor:pointer; color:#0068ff; font-weight:600;">Sao chép</span>
              </div>
            `;

            box.querySelector('.trans-close').addEventListener('click', () => box.remove());
            box.querySelector('.trans-copy').addEventListener('click', () => {
              navigator.clipboard.writeText(res.translated);
              box.querySelector('.trans-copy').innerText = 'Đã chép!';
              setTimeout(() => {
                if (box.querySelector('.trans-copy')) box.querySelector('.trans-copy').innerText = 'Sao chép';
              }, 1500);
            });

            // Find the message bubble card (.message-content-render, .text-message__container or bubble element)
            const bubbleElem = msgElem.closest('.message-content-render')
              || (chatMsg ? chatMsg.querySelector('.message-content-render') : null)
              || msgElem.closest('.text-message__container')
              || msgElem.closest('[class*="bubble"]')
              || msgElem;

            if (bubbleElem && bubbleElem.parentElement && bubbleElem.parentElement !== chatMsg) {
              bubbleElem.insertAdjacentElement('afterend', box);
            } else {
              const contentWrapper = msgElem.closest('.message-content-wrapper')
                || (chatMsg ? chatMsg.querySelector('.message-content-wrapper') : null);
              if (contentWrapper) {
                contentWrapper.appendChild(box);
              } else if (chatMsg) {
                const msgWrapper = chatMsg.querySelector('.message-wrapper');
                if (msgWrapper) {
                  msgWrapper.appendChild(box);
                } else {
                  msgElem.parentElement.appendChild(box);
                }
              } else {
                msgElem.parentElement.appendChild(box);
              }
            }
          }
        } catch (err) {
          hoverBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          `;
          console.error('[TADaZa Translate] Error:', err);
        }
      });
    }

    let hideTimer = null;
    document.addEventListener('mouseover', (e) => {
      if (!currentConfig.translate.enabled) {
        hoverBtn.style.display = 'none';
        return;
      }

      if (e.target === hoverBtn || hoverBtn.contains(e.target)) {
        if (hideTimer) clearTimeout(hideTimer);
        return;
      }

      // Do not trigger hover button on translation box or TADaZa UI elements
      if (e.target.closest && (e.target.closest('.tadaza-trans-box') || e.target.closest('#tadaza-drawer') || e.target.closest('#nav-item-tadaza'))) {
        return;
      }

      const bubble = e.target.closest && (
        e.target.closest('.text-message__container') ||
        e.target.closest('[class*="bubble-content"]') ||
        e.target.closest('[class*="msg-content"]') ||
        e.target.closest('[class*="message-content"]')
      );

      const msgText = bubble ? extractMessageText(bubble) : '';
      if (bubble && msgText.length > 0) {
        if (hideTimer) clearTimeout(hideTimer);
        activeHoverMessage = bubble;
        const rect = bubble.getBoundingClientRect();
        hoverBtn.style.display = 'flex';
        hoverBtn.style.top = `${Math.max(10, rect.top - 12)}px`;
        hoverBtn.style.left = `${rect.right - 14}px`;
      } else {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          hoverBtn.style.display = 'none';
        }, 350);
      }
    }, true);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* --------------------------------------------------------------------------
     4. Markdown & Code Snippet Feature
     -------------------------------------------------------------------------- */
  const KEYWORDS_BY_LANG = {
    javascript: /\b(const|let|var|function|return|if|else|for|while|switch|case|default|import|export|from|class|extends|new|this|async|await|try|catch|finally|throw|typeof|instanceof|true|false|null|undefined|void|in|of|yield)\b/g,
    typescript: /\b(const|let|var|function|return|if|else|for|while|switch|case|default|import|export|from|class|extends|new|this|async|await|try|catch|finally|throw|typeof|instanceof|true|false|null|undefined|void|in|of|yield|type|interface|enum|implements|public|private|protected|readonly|as|keyof|unknown|any|never)\b/g,
    python: /\b(def|return|if|elif|else|for|while|in|import|from|as|class|try|except|finally|with|lambda|pass|break|continue|True|False|None|and|or|not|is|yield|async|await|self|raise)\b/g,
    go: /\b(func|package|import|return|if|else|for|range|switch|case|default|type|struct|interface|var|const|go|chan|select|defer|nil|true|false|make|len|cap|map|new)\b/g,
    rust: /\b(fn|let|mut|pub|use|mod|struct|enum|impl|trait|for|in|if|else|match|return|loop|while|const|static|type|true|false|self|Self|Some|None|Ok|Err|async|await|move|ref|where|as)\b/g,
    c: /\b(int|float|double|char|void|bool|struct|union|enum|typedef|const|static|extern|return|if|else|for|while|do|switch|case|default|sizeof|NULL|true|false|include|define)\b/g,
    cpp: /\b(int|float|double|char|void|bool|struct|union|enum|typedef|const|static|extern|return|if|else|for|while|do|switch|case|default|sizeof|NULL|true|false|class|public|private|protected|virtual|override|new|delete|namespace|using|std|template|typename|auto)\b/g,
    csharp: /\b(int|string|bool|var|class|struct|interface|enum|public|private|protected|internal|static|readonly|return|if|else|for|foreach|while|switch|case|default|new|try|catch|finally|throw|async|await|using|namespace|get|set|true|false|null|void|override|virtual)\b/g,
    java: /\b(int|double|float|char|boolean|String|class|interface|enum|public|private|protected|static|final|return|if|else|for|while|do|switch|case|default|new|try|catch|finally|throw|throws|package|import|true|false|null|void|override|this|super)\b/g,
    sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|ASC|DESC|LIMIT|OFFSET|AND|OR|NOT|NULL|AS|UNION|ALL|HAVING|IN|LIKE|BETWEEN|DISTINCT|COUNT|SUM|AVG|MAX|MIN|VALUES|SET|PRIMARY|KEY|DATABASE)\b/gi,
    bash: /\b(if|then|fi|else|elif|for|in|do|done|while|until|case|esac|function|echo|export|set|unset|exit|return|local|source|sudo|cd|ls|grep|cat|chmod|chown|curl|wget)\b/g,
    json: /\b(true|false|null)\b/g,
    html: /\b(html|head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|button|input|form|script|style|link|meta|title)\b/g,
    css: /\b(color|background|margin|padding|border|display|flex|grid|width|height|font|position|top|left|right|bottom|overflow|z-index|opacity|transition|transform)\b/g
  };

  function highlightCode(rawCode, rawLang) {
    const lang = (rawLang || '').toLowerCase().trim();
    const kwRegex = KEYWORDS_BY_LANG[lang] || KEYWORDS_BY_LANG['javascript'];
    const lines = (rawCode || '').split('\n');

    const commentPrefix = (lang === 'python' || lang === 'bash') ? '#' : (lang === 'sql' ? '--' : '//');

    const tokenRegex = new RegExp(
      `(${commentPrefix}.*$)|` +
      `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|` +
      `\`(?:\\\\.|[^\`\\\\])*\`)|` +
      `(\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b)|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\\s*\\())|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)|` +
      `([+\\-*/%<>=!&|^~?:]{1,3})|` +
      `([{}()\\[\\],;.])`,
      'g'
    );

    return lines.map((line, lineIdx) => {
      let output = '';
      let lastIndex = 0;
      let match;
      tokenRegex.lastIndex = 0;

      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          output += escapeHtml(line.substring(lastIndex, match.index));
        }
        lastIndex = tokenRegex.lastIndex;

        const [full, comment, str, num, fn, ident, op, punct] = match;
        if (comment) {
          output += `<span class="hl-comment">${escapeHtml(comment)}</span>`;
        } else if (str) {
          output += `<span class="hl-string">${escapeHtml(str)}</span>`;
        } else if (num) {
          output += `<span class="hl-number">${escapeHtml(num)}</span>`;
        } else if (fn) {
          kwRegex.lastIndex = 0;
          if (kwRegex.test(fn)) {
            output += `<span class="hl-keyword">${escapeHtml(fn)}</span>`;
          } else {
            output += `<span class="hl-function">${escapeHtml(fn)}</span>`;
          }
        } else if (ident) {
          kwRegex.lastIndex = 0;
          if (kwRegex.test(ident)) {
            output += `<span class="hl-keyword">${escapeHtml(ident)}</span>`;
          } else {
            output += escapeHtml(ident);
          }
        } else if (op) {
          output += `<span class="hl-operator">${escapeHtml(op)}</span>`;
        } else if (punct) {
          output += `<span class="hl-punctuation">${escapeHtml(punct)}</span>`;
        } else {
          output += escapeHtml(full);
        }
      }

      if (lastIndex < line.length) {
        output += escapeHtml(line.substring(lastIndex));
      }

      return `<div class="tadaza-code-line"><span class="line-num">${lineIdx + 1}</span><span class="line-code">${output || ' '}</span></div>`;
    }).join('');
  }

  function renderSnippetToCanvas(code, lang = 'javascript') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scale = 2; // HiDPI / Retina 2x
    const fontSize = 13 * scale;
    const lineHeight = 22 * scale;
    const paddingX = 22 * scale;
    const headerHeight = 42 * scale;
    const paddingBottom = 18 * scale;

    const lines = (code || '').split('\n');
    const maxLineCount = lines.length;
    const lineNumWidth = (String(maxLineCount).length * 9 + 14) * scale;

    ctx.font = `500 ${fontSize}px 'JetBrains Mono', 'Fira Code', 'DejaVu Sans Mono', Consolas, monospace`;
    let maxTextWidth = 0;
    for (const l of lines) {
      const w = ctx.measureText(l).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const minWidth = 440 * scale;
    const contentWidth = Math.max(minWidth, lineNumWidth + maxTextWidth + paddingX * 2);
    const cardWidth = Math.min(contentWidth, 1400 * scale);
    const cardHeight = headerHeight + (lines.length * lineHeight) + paddingBottom;

    const outerPad = 28 * scale;
    canvas.width = cardWidth + outerPad * 2;
    canvas.height = cardHeight + outerPad * 2;

    // 1. Draw Canvas background gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#1e1e2e');
    grad.addColorStop(0.5, '#181825');
    grad.addColorStop(1, '#11111b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Window Card Shadow
    const cardX = outerPad;
    const cardY = outerPad;
    const radius = 12 * scale;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 24 * scale;
    ctx.shadowOffsetY = 10 * scale;

    ctx.fillStyle = '#181825';
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, radius);
    ctx.fill();
    ctx.restore();

    // Card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1 * scale;
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, radius);
    ctx.stroke();

    // 3. Header Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardWidth - radius, cardY);
    ctx.arcTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius, radius);
    ctx.lineTo(cardX + cardWidth, cardY + headerHeight);
    ctx.lineTo(cardX, cardY + headerHeight);
    ctx.lineTo(cardX, cardY + radius);
    ctx.arcTo(cardX, cardY, cardX + radius, cardY, radius);
    ctx.closePath();
    ctx.fill();

    // 3 macOS dots
    const dotY = cardY + headerHeight / 2;
    const dotR = 5.5 * scale;
    // Red
    ctx.fillStyle = '#ff5f56';
    ctx.beginPath();
    ctx.arc(cardX + 18 * scale, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    // Yellow
    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath();
    ctx.arc(cardX + 34 * scale, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    // Green
    ctx.fillStyle = '#27c93f';
    ctx.beginPath();
    ctx.arc(cardX + 50 * scale, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Language Title
    ctx.font = `600 ${11 * scale}px 'Inter', sans-serif`;
    ctx.fillStyle = '#a6adc8';
    ctx.textAlign = 'center';
    const langObj = SUPPORTED_LANGS.find(l => l.id === lang);
    const titleText = (langObj ? langObj.name : (lang || 'CODE').toUpperCase());
    ctx.fillText(titleText, cardX + cardWidth / 2, dotY + 4 * scale);

    // 4. Draw Code lines
    ctx.textAlign = 'left';
    const kwRegex = KEYWORDS_BY_LANG[lang] || KEYWORDS_BY_LANG['javascript'];
    const commentPrefix = (lang === 'python' || lang === 'bash') ? '#' : (lang === 'sql' ? '--' : '//');

    const tokenRegex = new RegExp(
      `(${commentPrefix}.*$)|` +
      `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|` +
      `\`(?:\\\\.|[^\`\\\\])*\`)|` +
      `(\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b)|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\\s*\\())|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)|` +
      `([+\\-*/%<>=!&|^~?:]{1,3})|` +
      `([{}()\\[\\],;.])`,
      'g'
    );

    lines.forEach((line, idx) => {
      const y = cardY + headerHeight + (idx + 1) * lineHeight - 5 * scale;

      // Line number
      ctx.font = `400 ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#585b70';
      ctx.fillText(String(idx + 1).padStart(String(maxLineCount).length, ' '), cardX + paddingX, y);

      // Code tokens
      let cursorX = cardX + paddingX + lineNumWidth;
      let lastIndex = 0;
      let match;
      tokenRegex.lastIndex = 0;

      ctx.font = `500 ${fontSize}px 'JetBrains Mono', 'Fira Code', monospace`;

      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          const text = line.substring(lastIndex, match.index);
          ctx.fillStyle = '#cdd6f4';
          ctx.fillText(text, cursorX, y);
          cursorX += ctx.measureText(text).width;
        }
        lastIndex = tokenRegex.lastIndex;

        const [full, comment, str, num, fn, ident, op, punct] = match;
        let tokenColor = '#cdd6f4';

        if (comment) tokenColor = '#6c7086';
        else if (str) tokenColor = '#a6e3a1';
        else if (num) tokenColor = '#fab387';
        else if (fn) {
          kwRegex.lastIndex = 0;
          tokenColor = kwRegex.test(fn) ? '#cba6f7' : '#89b4fa';
        } else if (ident) {
          kwRegex.lastIndex = 0;
          tokenColor = kwRegex.test(ident) ? '#cba6f7' : '#cdd6f4';
        } else if (op) tokenColor = '#89dceb';
        else if (punct) tokenColor = '#9399b2';

        ctx.fillStyle = tokenColor;
        ctx.fillText(full, cursorX, y);
        cursorX += ctx.measureText(full).width;
      }

      if (lastIndex < line.length) {
        const rest = line.substring(lastIndex);
        ctx.fillStyle = '#cdd6f4';
        ctx.fillText(rest, cursorX, y);
      }
    });

    return canvas;
  }

  function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  function formatInlineMarkdown(text) {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/`([^`\n]+)`/g, '<span class="tadaza-inline-code">$1</span>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    escaped = escaped.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return escaped;
  }

  function createCodeCardElement(code, lang) {
    const card = document.createElement('div');
    card.className = 'tadaza-code-card';

    const langObj = SUPPORTED_LANGS.find(l => l.id === (lang || '').toLowerCase());
    const langDisplay = langObj ? langObj.name.split(' ')[0] : (lang || 'CODE').toUpperCase();

    const highlightedHtml = highlightCode(code, lang);

    card.innerHTML = `
      <div class="tadaza-code-header">
        <div class="mac-dots">
          <span class="mac-dot mac-dot-red"></span>
          <span class="mac-dot mac-dot-yellow"></span>
          <span class="mac-dot mac-dot-green"></span>
        </div>
        <span class="tadaza-code-lang">${escapeHtml(langDisplay)}</span>
        <div class="tadaza-code-actions">
          <button class="tadaza-btn-copy-code" title="Sao chép toàn bộ code">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="btn-text">Sao chép</span>
          </button>
          <button class="tadaza-btn-copy-img" title="Sao chép ảnh snippet đẹp">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span class="btn-text">Ảnh</span>
          </button>
        </div>
      </div>
      <pre class="tadaza-code-content"><code>${highlightedHtml}</code></pre>
    `;

    // Copy Code button
    const copyBtn = card.querySelector('.tadaza-btn-copy-code');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(code);
        const textSpan = copyBtn.querySelector('.btn-text');
        textSpan.textContent = 'Đã chép!';
        setTimeout(() => { if (copyBtn.querySelector('.btn-text')) copyBtn.querySelector('.btn-text').textContent = 'Sao chép'; }, 1500);
      } catch (err) {
        console.warn('[TADaZa] Copy code failed:', err);
      }
    });

    // Copy Image button
    const imgBtn = card.querySelector('.tadaza-btn-copy-img');
    imgBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const canvas = renderSnippetToCanvas(code, lang);
        const dataUri = canvas.toDataURL('image/png');
        await bridge.copyImage(dataUri);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } catch (e) {}
          }
          const textSpan = imgBtn.querySelector('.btn-text');
          textSpan.textContent = 'Đã chép!';
          setTimeout(() => { if (imgBtn.querySelector('.btn-text')) imgBtn.querySelector('.btn-text').textContent = 'Ảnh'; }, 1500);
        }, 'image/png');
      } catch (err) {
        console.warn('[TADaZa] Copy image failed:', err);
      }
    });

    return card;
  }

  function formatMarkdownContent(element) {
    if (!currentConfig.markdown || !currentConfig.markdown.enabled) return;
    if (element.hasAttribute('data-tadaza-md')) return;
    if (element.querySelector('.tadaza-code-card')) return;

    // Check inner text
    const rawText = element.textContent || '';
    const codeBlockRegex = /```(?:([a-zA-Z0-9_+-]+)\n)?([\s\S]*?)```/g;
    const hasCodeBlocks = codeBlockRegex.test(rawText);
    const hasInline = /`[^`\n]+`|\*\*[^*]+\*\*|~~[^~]+~~/.test(rawText);

    if (!hasCodeBlocks && (!hasInline || !currentConfig.markdown.auto_format_inline)) {
      return;
    }

    if (element.querySelector('.text-message__container') || element.querySelector('[class*="bubble-content"]')) {
      return;
    }

    element.setAttribute('data-tadaza-md', '1');

    // Preserve time element if present
    const timeElem = element.querySelector('[class*="bubble-message-time"], [class*="message-inner-time"]');

    if (hasCodeBlocks) {
      codeBlockRegex.lastIndex = 0;
      const parts = [];
      let lastIdx = 0;
      let match;
      while ((match = codeBlockRegex.exec(rawText)) !== null) {
        if (match.index > lastIdx) {
          parts.push({ type: 'text', content: rawText.substring(lastIdx, match.index) });
        }
        lastIdx = codeBlockRegex.lastIndex;
        parts.push({ type: 'code', lang: match[1] || 'javascript', code: match[2] });
      }
      if (lastIdx < rawText.length) {
        parts.push({ type: 'text', content: rawText.substring(lastIdx) });
      }

      element.innerHTML = '';
      for (const part of parts) {
        if (part.type === 'text') {
          const textSpan = document.createElement('span');
          if (currentConfig.markdown.auto_format_inline) {
            textSpan.innerHTML = formatInlineMarkdown(part.content);
          } else {
            textSpan.textContent = part.content;
          }
          element.appendChild(textSpan);
        } else if (part.type === 'code') {
          const card = createCodeCardElement(part.code, part.lang);
          element.appendChild(card);
        }
      }
      if (timeElem) element.appendChild(timeElem);
    } else if (currentConfig.markdown.auto_format_inline && hasInline) {
      element.innerHTML = formatInlineMarkdown(rawText);
      if (timeElem) element.appendChild(timeElem);
    }
  }

  function setupMessageCodeFormatter() {
    let scanTimeout = null;
    const scanMessages = () => {
      if (!currentConfig.markdown || !currentConfig.markdown.enabled) return;

      const targets = document.querySelectorAll(
        '.text-message__container:not([data-tadaza-md]), ' +
        '[class*="bubble-content"]:not([data-tadaza-md]), ' +
        '[class*="msg-content"]:not([data-tadaza-md])'
      );

      targets.forEach(elem => {
        if (elem.closest('.tadaza-trans-box') || elem.closest('#tadaza-code-studio-overlay')) return;
        formatMarkdownContent(elem);
      });
    };

    scanMessages();

    const observer = new MutationObserver(() => {
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanMessages, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function insertTextIntoChatInput(text) {
    const richInput = document.querySelector('[id^="richInput"]') || document.getElementById('richInput') || document.querySelector('.rich-input');
    if (!richInput) return;
    richInput.focus();
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      richInput.innerText = (richInput.innerText ? richInput.innerText + '\n' : '') + text;
      richInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  async function pasteImageBlobIntoZalo(blob) {
    const richInput = document.querySelector('[id^="richInput"]') || document.getElementById('richInput') || document.querySelector('.rich-input');
    if (!richInput) return false;
    richInput.focus();
    try {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      document.execCommand('paste');
      return true;
    } catch (e) {
      try {
        const file = new File([blob], 'snippet.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const pasteEv = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        });
        richInput.dispatchEvent(pasteEv);
        return true;
      } catch (err2) {
        console.error('[TADaZa] Failed to paste snippet image:', err2);
        return false;
      }
    }
  }

  let studioModal = null;

  function openCodeStudioModal(initialCode = '', initialLang = 'javascript') {
    if (!studioModal) {
      studioModal = document.createElement('div');
      studioModal.id = 'tadaza-code-studio-overlay';
      document.body.appendChild(studioModal);
    }

    studioModal.innerHTML = `
      <div id="tadaza-code-studio-modal">
        <div class="tadaza-modal-header">
          <div class="tadaza-modal-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#89b4fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <span>TADaZa Code & Markdown Studio</span>
          </div>
          <div class="tadaza-modal-controls">
            <select class="tadaza-select" id="tadaza-studio-lang" style="min-width: 160px; font-size: 12px; padding: 4px 10px;">
              ${SUPPORTED_LANGS.map(l => `<option value="${l.id}" ${l.id === initialLang ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
            <button class="tadaza-close-btn" id="tadaza-studio-close" title="Đóng">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="tadaza-modal-body">
          <div class="tadaza-modal-pane editor-pane">
            <div class="tadaza-pane-header">
              <span>Trình soạn thảo mã (Editor)</span>
              <span style="font-size: 11px; opacity: 0.7;">Phím tắt: Tab để thụt dòng</span>
            </div>
            <textarea class="tadaza-code-textarea" id="tadaza-studio-editor" placeholder="// Dán hoặc gõ mã nguồn của bạn vào đây...&#10;function helloWorld() {&#10;  console.log('Hello from Zalo Linux!');&#10;}" spellcheck="false">${escapeHtml(initialCode)}</textarea>
          </div>

          <div class="tadaza-modal-pane preview-pane">
            <div class="tadaza-pane-header">
              <span>Xem trước ảnh Snippet (Carbon Style)</span>
              <span style="font-size: 11px; opacity: 0.7;">Độ phân giải 2x Retina</span>
            </div>
            <div class="tadaza-preview-container" id="tadaza-studio-preview-box"></div>
          </div>
        </div>

        <div class="tadaza-modal-footer">
          <button class="tadaza-action-btn secondary" id="tadaza-studio-btn-cancel">Hủy</button>
          <div class="tadaza-modal-btn-group">
            <button class="tadaza-action-btn secondary" id="tadaza-studio-btn-insert-text" title="Chèn markdown block vào ô chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 7 4 4 20 4 20 7"></polyline>
                <line x1="9" y1="20" x2="15" y2="20"></line>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
              <span>Chèn vào ô chat</span>
            </button>
            <button class="tadaza-action-btn secondary" id="tadaza-studio-btn-copy-img" title="Sao chép ảnh vào bộ nhớ tạm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="label-studio-copy-img">Sao chép ảnh</span>
            </button>
            <button class="tadaza-action-btn tadaza-btn-send-img" id="tadaza-studio-btn-send-img" title="Tự động dán ảnh vào khung chat Zalo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <span>Gửi dạng ảnh Snippet</span>
            </button>
          </div>
        </div>
      </div>
    `;

    studioModal.classList.add('open');

    const editor = studioModal.querySelector('#tadaza-studio-editor');
    const langSelect = studioModal.querySelector('#tadaza-studio-lang');
    const previewBox = studioModal.querySelector('#tadaza-studio-preview-box');
    const closeBtn = studioModal.querySelector('#tadaza-studio-close');
    const cancelBtn = studioModal.querySelector('#tadaza-studio-btn-cancel');
    const insertTextBtn = studioModal.querySelector('#tadaza-studio-btn-insert-text');
    const copyImgBtn = studioModal.querySelector('#tadaza-studio-btn-copy-img');
    const sendImgBtn = studioModal.querySelector('#tadaza-studio-btn-send-img');

    let currentCanvas = null;

    const updatePreview = () => {
      const code = editor.value || '// Không có mã nào';
      const lang = langSelect.value;
      currentCanvas = renderSnippetToCanvas(code, lang);
      currentCanvas.className = 'tadaza-canvas-preview';
      currentCanvas.style.maxWidth = '100%';
      currentCanvas.style.height = 'auto';
      previewBox.innerHTML = '';
      previewBox.appendChild(currentCanvas);
    };

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        updatePreview();
      }
    });

    editor.addEventListener('input', updatePreview);
    langSelect.addEventListener('change', updatePreview);

    updatePreview();
    setTimeout(() => editor.focus(), 100);

    const closeModal = () => {
      studioModal.classList.remove('open');
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    studioModal.addEventListener('click', (e) => {
      if (e.target === studioModal) closeModal();
    });

    insertTextBtn.addEventListener('click', () => {
      const code = editor.value.trim();
      if (!code) return;
      const lang = langSelect.value;
      const markdown = `\`\`\`${lang}\n${code}\n\`\`\``;
      insertTextIntoChatInput(markdown);
      closeModal();
    });

    copyImgBtn.addEventListener('click', async () => {
      if (!currentCanvas) return;
      const dataUri = currentCanvas.toDataURL('image/png');
      await bridge.copyImage(dataUri);
      currentCanvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch (e) {}
        }
        const label = studioModal.querySelector('#label-studio-copy-img');
        if (label) {
          label.textContent = 'Đã chép!';
          setTimeout(() => { if (label) label.textContent = 'Sao chép ảnh'; }, 1500);
        }
      }, 'image/png');
    });

    sendImgBtn.addEventListener('click', async () => {
      if (!currentCanvas) return;
      const dataUri = currentCanvas.toDataURL('image/png');
      await bridge.copyImage(dataUri);
      currentCanvas.toBlob(async (blob) => {
        if (!blob) return;
        closeModal();
        await pasteImageBlobIntoZalo(blob);
      }, 'image/png');
    });
  }

  function setupChatToolbarButton() {
    const insertButton = () => {
      if (document.getElementById('tadaza-btn-code-studio')) return;

      const bar = document.querySelector('.chat-box-toolbar')
        || document.querySelector('.chat-box-input__tools')
        || document.querySelector('.chat-box-bar')
        || document.querySelector('.chat-input-btns')
        || document.querySelector('#chat-box-bar-id')
        || document.querySelector('.chat-input-container__left-layout')
        || document.querySelector('.chat-input-container');

      if (!bar) return;

      const btn = document.createElement('div');
      btn.id = 'tadaza-btn-code-studio';
      btn.className = 'tadaza-chat-tool-btn';
      btn.title = 'Soạn Code & Markdown Snippet (Ctrl+Shift+M)';
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCodeStudioModal();
      });

      if (bar.classList.contains('chat-box-toolbar') || bar.classList.contains('chat-box-input__tools') || bar.classList.contains('chat-input-btns')) {
        bar.appendChild(btn);
      } else {
        bar.insertBefore(btn, bar.firstChild);
      }
    };

    insertButton();

    const observer = new MutationObserver(() => {
      insertButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setupInputMarkdownShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        let selectedText = '';
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          selectedText = selection.toString();
        }
        openCodeStudioModal(selectedText);
      }
    });
  }

  /* --------------------------------------------------------------------------
     5. Quick Parser Feature (Bank STK, VietQR, Tracking & Phone Detection)
     -------------------------------------------------------------------------- */
  const VIETNAM_BANKS = [
    { bin: '970436', shortName: 'VCB', code: 'vietcombank', name: 'Vietcombank', aliases: ['vietcombank', 'vcb', 'vietcom'] },
    { bin: '970407', shortName: 'TCB', code: 'techcombank', name: 'Techcombank', aliases: ['techcombank', 'tcb', 'techcom'] },
    { bin: '970422', shortName: 'MB', code: 'mbbank', name: 'MBBank', aliases: ['mbbank', 'mb', 'quan doi'] },
    { bin: '970432', shortName: 'VPB', code: 'vpbank', name: 'VPBank', aliases: ['vpbank', 'vpb', 'vp'] },
    { bin: '970416', shortName: 'ACB', code: 'acb', name: 'ACB', aliases: ['acb', 'a chau'] },
    { bin: '970418', shortName: 'BIDV', code: 'bidv', name: 'BIDV', aliases: ['bidv'] },
    { bin: '970441', shortName: 'VIB', code: 'vib', name: 'VIB', aliases: ['vib', 'quoc te'] },
    { bin: '970423', shortName: 'TPB', code: 'tpbank', name: 'TPBank', aliases: ['tpbank', 'tpb', 'tien phong'] },
    { bin: '970415', shortName: 'CTG', code: 'vietinbank', name: 'VietinBank', aliases: ['vietinbank', 'ctg', 'vietin'] },
    { bin: '970403', shortName: 'STB', code: 'sacombank', name: 'Sacombank', aliases: ['sacombank', 'stb', 'sacom'] },
    { bin: '970437', shortName: 'HDB', code: 'hdbank', name: 'HDBank', aliases: ['hdbank', 'hdb'] },
    { bin: '970448', shortName: 'OCB', code: 'ocb', name: 'OCB', aliases: ['ocb', 'phuong dong'] },
    { bin: '970443', shortName: 'SHB', code: 'shb', name: 'SHB', aliases: ['shb'] },
    { bin: '970426', shortName: 'MSB', code: 'msb', name: 'MSB', aliases: ['msb', 'hang hai'] },
    { bin: '970449', shortName: 'LPB', code: 'lpbank', name: 'LPBank', aliases: ['lpbank', 'lpb', 'lienvietpostbank', 'lienviet'] },
    { bin: '970440', shortName: 'SeABank', code: 'seabank', name: 'SeABank', aliases: ['seabank', 'sea'] },
    { bin: '970424', shortName: 'Shinhan', code: 'shinhanbank', name: 'Shinhan Bank', aliases: ['shinhan', 'shinhanbank'] },
    { bin: '546034', shortName: 'Cake', code: 'cake', name: 'Cake by VPBank', aliases: ['cake'] },
    { bin: '963388', shortName: 'Timo', code: 'timo', name: 'Timo', aliases: ['timo'] },
    { bin: '971005', shortName: 'ViettelMoney', code: 'viettelmoney', name: 'Viettel Money', aliases: ['viettelmoney', 'viettelpay', 'viettel'] },
    { bin: '971011', shortName: 'VNPTMoney', code: 'vnptmoney', name: 'VNPT Money', aliases: ['vnptmoney', 'vnpt'] }
  ];

  const TRACKING_PATTERNS = [
    {
      carrier: 'Shopee Express (SPX)',
      code: 'spx',
      regex: /\b(SPXVN[0-9A-Za-z]{8,14}|VN\d{12,15}[A-Za-z]?)\b/i,
      url: (c) => `https://spx.vn/track?tracking_number=${c}`
    },
    {
      carrier: 'Giao Hàng Tiết Kiệm (GHTK)',
      code: 'ghtk',
      regex: /(?:ghtk|tiết\s*kiệm)[^\d]{0,20}([0-9]{9,11}|S\d+\.[A-Za-z0-9.]+)\b/i,
      url: (c) => `https://i.ghtk.vn/${c}`
    },
    {
      carrier: 'Viettel Post',
      code: 'viettelpost',
      regex: /(?:viettel|vtp)[^\d]{0,20}(VT[0-9A-Za-z]{9,12}|[0-9]{9,12})\b/i,
      url: (c) => `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?order_number=${c}`
    },
    {
      carrier: 'J&T Express',
      code: 'jtexpress',
      regex: /(?:j&t|jnt)[^\d]{0,20}([0-9]{10,12}|JNT[0-9A-Za-z]{8,12})\b/i,
      url: (c) => `https://jtexpress.vn/vi/tracking?type=track&billcode=${c}`
    }
  ];

  const BANK_STOP_WORDS = new Set([
    'ck', 'cho', 'tao', 'to', 'tớ', 'minh', 'mình', 'ban', 'bạn', 'anh', 'em', 'chi', 'chị',
    'vao', 'vào', 'qua', 'sang', 'gui', 'gửi', 'ho', 'hộ', 'nhe', 'nhé', 'nha', 'cai', 'cái',
    'nay', 'này', 'thi', 'thì', 'no', 'nó', 'khong', 'không', 'nhan', 'nhận', 'duoc', 'được',
    'tien', 'tiền', 'chuyen', 'chuyển', 'khoan', 'khoản', 'so', 'số', 'tai', 'tài', 'bao',
    'nhieu', 'nhiều', 'voi', 'với', 'ok', 'rep', 'giup', 'giúp', 'di', 'đi', 'roi', 'rồi', 'xong',
    'chua', 'chưa', 'ngay', 'hom', 'hôm', 'gio', 'giờ', 'tk', 'stk', 'gia', 'giá', 'fix', 'bot',
    'bớt', 'shop', 'bac', 'bác', 'ong', 'ông', 'chu', 'chú', 'noi', 'nội', 'dung',
    'la', 'là', 'cua', 'của', 'day', 'đây', 'ạ', 'a'
  ]);

  function parseBankInfo(text) {
    if (!text || typeof text !== 'string') return null;
    const textLower = text.toLowerCase();

    // 1. Identify amount first
    let amount = null;
    let amountRawStr = '';
    const amtMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(k|củ|tr|triệu|đ|d|vnd|dong|đồng)\b/i);
    if (amtMatch) {
      amountRawStr = amtMatch[0];
      const numStr = amtMatch[1].replace(/\./g, '').replace(/,/g, '.');
      const unit = amtMatch[2].toLowerCase();
      const val = parseFloat(numStr);
      if (unit === 'k') amount = Math.round(val * 1000);
      else if (['tr', 'triệu', 'củ'].includes(unit)) amount = Math.round(val * 1000000);
      else amount = Math.round(val);
    } else {
      const amtMatch2 = text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
      if (amtMatch2) {
        const num = amtMatch2[1].replace(/[.,]/g, '');
        if (parseInt(num, 10) >= 1000) {
          amount = parseInt(num, 10);
          amountRawStr = amtMatch2[0];
        }
      }
    }

    // 2. Identify bank
    let foundBank = null;
    let bankMatchIndex = -1;
    let bankMatchLength = 0;
    for (const b of VIETNAM_BANKS) {
      for (const a of b.aliases) {
        const reg = new RegExp(`\\b${a}\\b`, 'i');
        const m = textLower.match(reg);
        if (m) {
          foundBank = b;
          bankMatchIndex = m.index;
          bankMatchLength = m[0].length;
          break;
        }
      }
      if (foundBank) break;
    }

    const hasBankKeyword = /\b(stk|số\s*tk|tài\s*khoản|chuyển\s*khoản|ck|c\/k|alias|nickname)\b/i.test(textLower);
    if (!foundBank && !hasBankKeyword) return null;

    // Helper: validate account candidate (digits or alphanumeric alias)
    function isValidAccountCandidate(candidate, rawOriginalWord) {
      if (!candidate || typeof candidate !== 'string') return false;
      const candLower = candidate.toLowerCase();
      if (VIETNAM_BANKS.some(b => b.aliases.includes(candLower))) return false;
      if (BANK_STOP_WORDS.has(candLower)) return false;
      if (amountRawStr && (candidate === amountRawStr || candLower === amountRawStr.toLowerCase())) return false;
      if (/^\d+(k|tr|cu|củ|vnd|d|đ)?$/i.test(candLower) && candLower.endsWith('k')) return false;
      // If the original token in text has Vietnamese accents (e.g., "chuyển" -> "chuy"), it is NOT an alias
      if (rawOriginalWord && /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(rawOriginalWord)) {
        return false;
      }
      if (candidate.length < 4 || candidate.length > 25) return false;
      return true;
    }

    // 3. Identify account number or alias
    let accountNo = null;

    // Pattern A: Explicit prefix (stk, tk, số tk, tài khoản, alias, nickname)
    const prefixRegex = /(?:stk|số\s*tk|tk|tài\s*khoản|alias|nickname|nick)[\s:]+([A-Za-z0-9_.-]{4,25})\b/i;
    const pMatch = text.match(prefixRegex);
    if (pMatch) {
      const candidate = pMatch[1];
      const fullWordMatch = text.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
      const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
      if (isValidAccountCandidate(candidate, fullWord)) {
        accountNo = candidate;
      }
    }

    // Pattern B: Traditional numeric STK (6-19 digits)
    if (!accountNo) {
      const numericCandidates = text.match(/\b[0-9]{6,19}\b/g);
      if (numericCandidates && numericCandidates.length > 0) {
        for (const num of numericCandidates) {
          if (amount && (num === String(amount) || num === amountRawStr.replace(/[.,]/g, ''))) {
            continue;
          }
          accountNo = num;
          break;
        }
      }
    }

    // Pattern C: If bank was found, check adjacent/nearby tokens for Nickname/Alias
    if (!accountNo && foundBank) {
      // Check right after bank: e.g. "tpbank nobianh78" or "tpbank : nobianh78" or "tpbank stk nobianh78"
      const afterBankStr = text.substring(bankMatchIndex + bankMatchLength);
      const afterMatch = afterBankStr.match(/^[\s:,-]*(?:stk|tk|la|là|cua|của|so|số|nick|alias)?[\s:,-]*([A-Za-z0-9_.-]{4,25})\b/i);
      if (afterMatch) {
        const candidate = afterMatch[1];
        const fullWordMatch = afterBankStr.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
        const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
        if (isValidAccountCandidate(candidate, fullWord)) {
          const hasDigits = /\d/.test(candidate);
          if (hasDigits || hasBankKeyword || amount || candidate.length >= 6) {
            accountNo = candidate;
          }
        }
      }

      // Check right before bank: e.g. "nobianh78 tpbank"
      if (!accountNo) {
        const beforeBankStr = text.substring(0, bankMatchIndex);
        const beforeMatch = beforeBankStr.match(/([A-Za-z0-9_.-]{4,25})[\s:,-]*$/i);
        if (beforeMatch) {
          const candidate = beforeMatch[1];
          const fullWordMatch = beforeBankStr.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
          const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
          if (isValidAccountCandidate(candidate, fullWord)) {
            const hasDigits = /\d/.test(candidate);
            if (hasDigits || hasBankKeyword || amount || candidate.length >= 6) {
              accountNo = candidate;
            }
          }
        }
      }
    }

    if (!accountNo) return null;

    // 4. Identify Account Name (Title Case or UPPERCASE 2-5 words)
    let accountName = '';
    let cleanedForName = text.replace(new RegExp(accountNo, 'g'), '');
    cleanedForName = cleanedForName.replace(/\b\d+([.,]\d+)?\s*(k|củ|tr|triệu|đ|d|vnd|dong|đồng)?\b/gi, '');
    cleanedForName = cleanedForName.replace(/(?:^|\s+)(?:stk|số\s*tk|tk|tài\s*khoản|chuyển\s*khoản|ck|tiền|c\/k|vao|vào|cho|to|tớ|minh|mình|nhé|nha|vcb|tcb|mb|bidv|acb|vietcombank|techcombank|mbbank|tpbank)(?=\s+|$)/gi, ' ');
    const nameMatches = cleanedForName.match(/\b[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){1,4}\b/g);
    if (nameMatches && nameMatches.length > 0) {
      const valid = nameMatches.filter(n => {
        const words = n.trim().split(/\s+/);
        return words.length >= 2 && words.every(w => /^[A-ZÀ-Ỹ]/.test(w));
      });
      if (valid.length > 0) {
        accountName = valid.reduce((a, b) => a.length >= b.length ? a : b).trim();
      }
    }

    return {
      bank: foundBank || { bin: '970436', shortName: 'BANK', code: 'vietcombank', name: 'Ngân hàng' },
      accountNo,
      amount,
      accountName
    };
  }

  function parseTrackingInfo(text) {
    if (!text || typeof text !== 'string') return null;
    for (const item of TRACKING_PATTERNS) {
      const m = text.match(item.regex);
      if (m) {
        const code = m[1];
        return {
          carrier: item.carrier,
          code,
          url: item.url(code)
        };
      }
    }
    const spxMatch = text.match(/\b(SPXVN[0-9A-Za-z]{8,14})\b/i);
    if (spxMatch) {
      const code = spxMatch[1];
      return {
        carrier: 'Shopee Express (SPX)',
        code,
        url: `https://spx.vn/track?tracking_number=${code}`
      };
    }
    return null;
  }

  function parsePhoneNumber(text) {
    if (!text || typeof text !== 'string') return null;
    const m = text.match(/\b(?:\+84|0)(?:3|5|7|8|9)\d{8}\b/);
    return m ? m[0] : null;
  }

  function formatCurrencyVND(amount) {
    if (!amount) return '';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  }

  let vietqrModal = null;

  function openVietQRModal({ bank, accountNo, amount, accountName, note = '' }) {
    if (!vietqrModal) {
      vietqrModal = document.createElement('div');
      vietqrModal.id = 'tadaza-vietqr-overlay';
      document.body.appendChild(vietqrModal);
    }

    const template = (currentConfig.quick_parser && currentConfig.quick_parser.default_qr_template) || 'compact2';
    const params = new URLSearchParams();
    if (amount) params.append('amount', amount);
    if (accountName) params.append('accountName', accountName);
    if (note) params.append('addInfo', note);

    const bankIdentifier = bank.bin || bank.code || bank.shortName;
    const qrImageUrl = `https://img.vietqr.io/image/${bankIdentifier}-${accountNo}-${template}.png?${params.toString()}`;

    vietqrModal.innerHTML = `
      <div id="tadaza-vietqr-modal">
        <div class="tadaza-vietqr-header">
          <div class="tadaza-vietqr-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            <span>Mã VietQR Chuyển Khoản</span>
          </div>
          <button class="tadaza-close-btn" id="tadaza-vietqr-close" title="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="tadaza-vietqr-body">
          <div class="tadaza-qr-img-wrap">
            <img class="tadaza-qr-img" id="tadaza-qr-img-elem" src="${qrImageUrl}" alt="VietQR Code" />
          </div>

          <div class="tadaza-vietqr-details">
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Ngân hàng:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-bank-badge">${escapeHtml(bank.shortName)}</span>
                <span class="tadaza-detail-val">${escapeHtml(bank.name)}</span>
              </div>
            </div>

            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Số tài khoản:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val" id="val-qr-stk">${escapeHtml(accountNo)}</span>
                <button class="tadaza-copy-mini-btn" id="btn-qr-copy-stk" title="Sao chép STK">Sao chép</button>
              </div>
            </div>

            ${accountName ? `
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Chủ tài khoản:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val" style="text-transform: uppercase;">${escapeHtml(accountName)}</span>
              </div>
            </div>` : ''}

            ${amount ? `
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Số tiền:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val tadaza-parser-amount">${formatCurrencyVND(amount)}</span>
                <button class="tadaza-copy-mini-btn" id="btn-qr-copy-amount" title="Sao chép số tiền">Sao chép</button>
              </div>
            </div>` : ''}
          </div>
        </div>

        <div class="tadaza-vietqr-footer">
          <button class="tadaza-action-btn secondary" id="tadaza-vietqr-btn-close">Đóng</button>
          <div style="display: flex; gap: 8px;">
            <button class="tadaza-action-btn secondary" id="tadaza-vietqr-btn-copy-img" title="Sao chép ảnh QR">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="label-qr-copy-img">Sao chép ảnh QR</span>
            </button>
            <button class="tadaza-action-btn primary" id="tadaza-vietqr-btn-download" title="Tải ảnh QR về máy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Tải ảnh</span>
            </button>
          </div>
        </div>
      </div>
    `;

    vietqrModal.classList.add('open');

    const closeModal = () => vietqrModal.classList.remove('open');
    vietqrModal.querySelector('#tadaza-vietqr-close').addEventListener('click', closeModal);
    vietqrModal.querySelector('#tadaza-vietqr-btn-close').addEventListener('click', closeModal);
    vietqrModal.addEventListener('click', (e) => {
      if (e.target === vietqrModal) closeModal();
    });

    // Copy STK
    const copyStkBtn = vietqrModal.querySelector('#btn-qr-copy-stk');
    if (copyStkBtn) {
      copyStkBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(accountNo);
        copyStkBtn.textContent = 'Đã chép!';
        setTimeout(() => { copyStkBtn.textContent = 'Sao chép'; }, 1500);
      });
    }

    // Copy Amount
    const copyAmtBtn = vietqrModal.querySelector('#btn-qr-copy-amount');
    if (copyAmtBtn && amount) {
      copyAmtBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(amount.toString());
        copyAmtBtn.textContent = 'Đã chép!';
        setTimeout(() => { copyAmtBtn.textContent = 'Sao chép'; }, 1500);
      });
    }

    // Copy QR Image
    const copyImgBtn = vietqrModal.querySelector('#tadaza-vietqr-btn-copy-img');
    if (copyImgBtn) {
      copyImgBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(qrImageUrl);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = async () => {
            const dataUri = reader.result;
            if (bridge.copyImage) await bridge.copyImage(dataUri);
          };
          reader.readAsDataURL(blob);
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          }
          const label = vietqrModal.querySelector('#label-qr-copy-img');
          label.textContent = 'Đã chép ảnh!';
          setTimeout(() => { label.textContent = 'Sao chép ảnh QR'; }, 1500);
        } catch (err) {
          console.warn('[TADaZa] Failed to copy QR image:', err);
        }
      });
    }

    // Download QR Image
    const dlBtn = vietqrModal.querySelector('#tadaza-vietqr-btn-download');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = qrImageUrl;
        a.download = `VietQR_${bank.shortName}_${accountNo}.png`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }
  }

  function setupQuickParser() {
    let scanTimeout = null;

    const scanMessages = () => {
      const qp = currentConfig.quick_parser;
      if (!qp || !qp.enabled) return;

      const targets = document.querySelectorAll(
        '.text-message__container:not([data-tadaza-parsed]), ' +
        '[class*="bubble-content"]:not([data-tadaza-parsed]), ' +
        '[class*="msg-content"]:not([data-tadaza-parsed])'
      );

      targets.forEach(elem => {
        if (elem.closest('.tadaza-trans-box') || elem.closest('.tadaza-parser-box') || elem.closest('#tadaza-code-studio-overlay') || elem.closest('#tadaza-vietqr-overlay')) {
          return;
        }

        if (elem.querySelector('.text-message__container') || elem.querySelector('[class*="bubble-content"]')) {
          return;
        }

        elem.setAttribute('data-tadaza-parsed', '1');

        const rawText = extractMessageText(elem);
        if (!rawText || rawText.length < 5) return;

        const chatMsg = elem.closest('.chat-message, [class*="msg-item"], [class*="chat-item"]');
        const parentToAttach = elem.closest('.message-content-render')
          || (chatMsg ? chatMsg.querySelector('.message-content-render') : null)
          || elem.closest('.text-message__container')
          || elem.closest('[class*="bubble"]')
          || elem;

        // 1. Check Bank Transfer
        if (qp.auto_detect_bank) {
          const bankInfo = parseBankInfo(rawText);
          if (bankInfo) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span class="tadaza-bank-badge">${escapeHtml(bankInfo.bank.shortName)}</span>
                  <span>${escapeHtml(bankInfo.bank.name)}</span>
                </div>
                ${bankInfo.amount ? `<span class="tadaza-parser-amount">${formatCurrencyVND(bankInfo.amount)}</span>` : ''}
              </div>
              <div class="tadaza-parser-content">
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">STK:</span>
                  <span class="tadaza-parser-val">${escapeHtml(bankInfo.accountNo)}</span>
                </div>
                ${bankInfo.accountName ? `
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">Tên:</span>
                  <span class="tadaza-parser-val" style="text-transform: uppercase;">${escapeHtml(bankInfo.accountName)}</span>
                </div>` : ''}
              </div>
              <div class="tadaza-parser-actions">
                <button class="tadaza-parser-btn vietqr" title="Mở mã QR chuẩn VietQR quét chuyển tiền ngay">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <span>Tạo VietQR</span>
                </button>
                <button class="tadaza-parser-btn btn-copy-stk" title="Sao chép số tài khoản">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span class="btn-text">Chép STK</span>
                </button>
                ${bankInfo.amount ? `
                <button class="tadaza-parser-btn btn-copy-amt" title="Sao chép số tiền">
                  <span class="btn-text">Chép số tiền</span>
                </button>` : ''}
              </div>
            `;

            box.querySelector('.vietqr').addEventListener('click', (e) => {
              e.stopPropagation();
              openVietQRModal(bankInfo);
            });

            const copyStkBtn = box.querySelector('.btn-copy-stk');
            copyStkBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(bankInfo.accountNo);
              const txt = copyStkBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Chép STK'; }, 1500);
            });

            const copyAmtBtn = box.querySelector('.btn-copy-amt');
            if (copyAmtBtn && bankInfo.amount) {
              copyAmtBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await navigator.clipboard.writeText(bankInfo.amount.toString());
                const txt = copyAmtBtn.querySelector('.btn-text');
                txt.textContent = 'Đã chép!';
                setTimeout(() => { txt.textContent = 'Chép số tiền'; }, 1500);
              });
            }

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
            return;
          }
        }

        // 2. Check Tracking Code
        if (qp.auto_detect_tracking) {
          const tracking = parseTrackingInfo(rawText);
          if (tracking) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span style="font-size: 15px;">🚚</span>
                  <span>${escapeHtml(tracking.carrier)}</span>
                </div>
              </div>
              <div class="tadaza-parser-content">
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">Mã vận đơn:</span>
                  <span class="tadaza-parser-val">${escapeHtml(tracking.code)}</span>
                </div>
              </div>
              <div class="tadaza-parser-actions">
                <button class="tadaza-parser-btn btn-track" style="background:#0068ff; color:#fff; border:none;" title="Mở trang web tra cứu hành trình đơn hàng">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <span>Tra cứu đơn</span>
                </button>
                <button class="tadaza-parser-btn btn-copy-track" title="Sao chép mã vận đơn">
                  <span class="btn-text">Chép mã</span>
                </button>
              </div>
            `;

            box.querySelector('.btn-track').addEventListener('click', async (e) => {
              e.stopPropagation();
              if (bridge.openExternal) {
                await bridge.openExternal(tracking.url);
              } else {
                window.open(tracking.url, '_blank');
              }
            });

            const copyTrackBtn = box.querySelector('.btn-copy-track');
            copyTrackBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(tracking.code);
              const txt = copyTrackBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Chép mã'; }, 1500);
            });

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
            return;
          }
        }

        // 3. Check Phone Number
        if (qp.auto_detect_phone) {
          const phone = parsePhoneNumber(rawText);
          if (phone) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span style="font-size: 14px;">📞</span>
                  <span>Số điện thoại:</span>
                  <span class="tadaza-parser-val">${escapeHtml(phone)}</span>
                </div>
                <div class="tadaza-parser-actions" style="margin-top:0;">
                  <button class="tadaza-parser-btn btn-copy-phone" title="Sao chép số điện thoại">
                    <span class="btn-text">Sao chép SĐT</span>
                  </button>
                </div>
              </div>
            `;

            const copyPhoneBtn = box.querySelector('.btn-copy-phone');
            copyPhoneBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(phone);
              const txt = copyPhoneBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Sao chép SĐT'; }, 1500);
            });

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
          }
        }
      });
    };

    scanMessages();

    const observer = new MutationObserver(() => {
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanMessages, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* --------------------------------------------------------------------------
     6. Build TADaZa UI (Left Navigation Bar Button & Drawer Panel)
     -------------------------------------------------------------------------- */
  function buildUI() {
    if (document.getElementById('tadaza-drawer')) return;

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'tadaza-overlay';

    // Create Drawer
    const drawer = document.createElement('div');
    drawer.id = 'tadaza-drawer';

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    const toggleDrawer = () => {
      const isOpen = drawer.classList.contains('open');
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    };

    const openDrawer = () => {
      renderDrawerContent();
      const nav = document.querySelector('.nav__tabs') || document.querySelector('.nav');
      if (nav) {
        const rect = nav.getBoundingClientRect();
        drawer.style.left = `${rect.right}px`;
        overlay.style.left = `${rect.right}px`;
        overlay.style.width = `calc(100vw - ${rect.right}px)`;
      }
      drawer.classList.add('open');
      overlay.classList.add('open');
      const navBtn = document.getElementById('nav-item-tadaza');
      if (navBtn) navBtn.classList.add('active');
    };

    const closeDrawer = () => {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      const navBtn = document.getElementById('nav-item-tadaza');
      if (navBtn) navBtn.classList.remove('active');
    };

    overlay.addEventListener('click', closeDrawer);

    // Watch for React re-renders of the left navigation bar
    const navObserver = new MutationObserver(() => {
      if (!document.getElementById('nav-item-tadaza')) {
        attachSidebarButton(toggleDrawer);
      }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });

    renderDrawerContent();
  }

  function attachSidebarButton(toggleDrawer) {
    if (document.getElementById('nav-item-tadaza')) return;

    const navBottom = document.querySelector('.nav__tabs__bottom');
    const navTop = document.querySelector('.nav__tabs__top');
    const navTabs = document.querySelector('.nav__tabs');

    const btn = document.createElement('div');
    btn.id = 'nav-item-tadaza';
    btn.className = 'nav__tabs__bottom__btn tadaza-nav-item';
    btn.title = 'TADaZa - Tiện ích mở rộng';
    btn.innerHTML = `
      <svg class="tadaza-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 11a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2 2 2 0 0 1 4 0 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 1 0 4 2 2 0 0 0-2 2v1a2 2 0 0 1-2 2h-1a2 2 0 0 0-2 2 2 2 0 0 1-4 0 2 2 0 0 0-2-2H6a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2z"/>
      </svg>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDrawer();
    });

    if (navBottom && navBottom.lastElementChild) {
      navBottom.insertBefore(btn, navBottom.lastElementChild);
    } else if (navTop) {
      navTop.appendChild(btn);
    } else if (navTabs) {
      navTabs.appendChild(btn);
    }
  }

  let activeTab = 'theme'; // 'theme' | 'privacy' | 'translate'

  function renderDrawerContent() {
    const drawer = document.getElementById('tadaza-drawer');
    if (!drawer) return;

    if (activeTab === 'features') activeTab = 'theme';

    const t = currentConfig.theme;
    const p = currentConfig.privacy;
    const tr = currentConfig.translate;

    drawer.innerHTML = `
      <div class="tadaza-header">
        <div class="tadaza-title-wrap">
          <span class="tadaza-badge">LINUX</span>
          <h2 class="tadaza-title">TADaZa Control Center</h2>
        </div>
        <button class="tadaza-close-btn" id="tadaza-close" title="Đóng">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="tadaza-tabs">
        <button class="tadaza-tab-btn ${activeTab === 'theme' ? 'active' : ''}" data-tab="theme">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
          </svg>
          <span>Giao diện</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'privacy' ? 'active' : ''}" data-tab="privacy">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>Riêng tư</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'translate' ? 'active' : ''}" data-tab="translate">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 8l6 6"></path>
            <path d="M4 14l6-6 2-3"></path>
            <path d="M2 5h12"></path>
            <path d="M7 2h1"></path>
            <path d="M22 22l-5-10-5 10"></path>
            <path d="M14 18h6"></path>
          </svg>
          <span>Dịch thuật</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'markdown' ? 'active' : ''}" data-tab="markdown">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span>Markdown & Code</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'quick_parser' ? 'active' : ''}" data-tab="quick_parser">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
          <span>Trích xuất & VietQR</span>
        </button>
      </div>

      <div class="tadaza-content">
        ${renderTabContent()}
      </div>
    `;

    // Bind Close Button
    drawer.querySelector('#tadaza-close').addEventListener('click', () => {
      drawer.classList.remove('open');
      document.getElementById('tadaza-overlay').classList.remove('open');
      const navBtn = document.getElementById('nav-item-tadaza');
      if (navBtn) navBtn.classList.remove('active');
    });

    // Bind Tab Switching
    drawer.querySelectorAll('.tadaza-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        renderDrawerContent();
      });
    });

    // Bind Controls for Active Tab
    bindTabEvents(drawer);
  }

  function renderTabContent() {
    const t = currentConfig.theme;
    const p = currentConfig.privacy;
    const tr = currentConfig.translate;
    const f = currentConfig.features;

    if (activeTab === 'theme') {
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Chế độ hiển thị (Theme)</h3>
          <div class="tadaza-item tadaza-item-col">
            <div class="tadaza-btn-group" id="group-theme-mode">
              <button class="tadaza-btn-choice ${t.mode === 'light' ? 'active' : ''}" data-mode="light">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <span>Sáng</span>
              </button>
              <button class="tadaza-btn-choice ${t.mode === 'dark' ? 'active' : ''}" data-mode="dark">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <span>Tối (Dark)</span>
              </button>
              <button class="tadaza-btn-choice ${t.mode === 'system' ? 'active' : ''}" data-mode="system">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <span>Hệ thống</span>
              </button>
            </div>
            <div class="tadaza-item-desc">Đồng bộ tự động theo theme tối của hệ điều hành hoặc chọn màu tối chuyên sâu.</div>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Phông chữ & Cỡ chữ</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Kiểu phông chữ</span>
              <span class="tadaza-item-desc">Tối ưu hiển thị tiếng Việt sắc nét</span>
            </div>
            <select class="tadaza-select" id="select-font">
              ${FONT_OPTIONS.map(opt => `<option value="${opt.value}" ${t.font_family === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
          </div>

          <div class="tadaza-item tadaza-item-col">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Kích thước chữ tin nhắn</span>
              <span class="tadaza-item-desc">Điều chỉnh từ 12px đến 22px</span>
            </div>
            <div class="tadaza-range-wrap">
              <input type="range" class="tadaza-range" id="range-fontsize" min="12" max="22" value="${t.font_size || 14}">
              <span class="tadaza-range-val" id="val-fontsize">${t.font_size || 14}px</span>
            </div>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Hình nền cuộc trò chuyện</h3>
          <div class="tadaza-item tadaza-item-col">
            <div style="display:flex; gap:8px;">
              <button class="tadaza-action-btn" id="btn-choose-wallpaper">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Chọn ảnh nền từ máy</span>
              </button>
              ${t.wallpaper ? '<button class="tadaza-action-btn secondary" id="btn-clear-wallpaper">Xóa nền</button>' : ''}
            </div>
            ${t.wallpaper ? `
              <div class="tadaza-range-wrap" style="margin-top:8px;">
                <span class="tadaza-item-desc" style="width:70px;">Độ mờ:</span>
                <input type="range" class="tadaza-range" id="range-wallpaper-opacity" min="0.2" max="1" step="0.05" value="${t.wallpaper_opacity}">
                <span class="tadaza-range-val">${Math.round(t.wallpaper_opacity * 100)}%</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (activeTab === 'privacy') {
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Chống nhìn trộm (Anti-peeping)</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Bật chống nhìn trộm</span>
              <span class="tadaza-item-desc">Làm mờ nội dung, chỉ rõ khi rê chuột vào</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-anti-peeping" ${p.anti_peeping ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!p.anti_peeping ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Làm mờ tin nhắn văn bản</span>
              <span class="tadaza-item-desc">Làm mờ nội dung chat & tin nhắn xem trước</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-blur-messages" ${p.anti_peeping && p.blur_messages ? 'checked' : ''} ${!p.anti_peeping ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!p.anti_peeping ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Làm mờ hình ảnh & video</span>
              <span class="tadaza-item-desc">Bảo vệ hình ảnh nhạy cảm khi ở nơi công cộng</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-blur-media" ${p.anti_peeping && p.blur_media ? 'checked' : ''} ${!p.anti_peeping ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!p.anti_peeping ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Làm mờ tên & Avatar người gửi</span>
              <span class="tadaza-item-desc">Giữ kín danh tính người đang trò chuyện</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-blur-names" ${p.anti_peeping && p.blur_names ? 'checked' : ''} ${!p.anti_peeping ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Ẩn trạng thái hoạt động</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Ẩn "Đang soạn tin..."</span>
              <span class="tadaza-item-desc">Đối phương không thấy biểu tượng soạn văn bản</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-hide-typing" ${p.hide_typing ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Ẩn trạng thái "Đã xem"</span>
              <span class="tadaza-item-desc">Đọc tin thoải mái không gửi báo cáo Đã xem</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-hide-seen" ${p.hide_seen ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Ẩn trạng thái "Đã nhận"</span>
              <span class="tadaza-item-desc">Chặn báo cáo tin nhắn đã phát tới máy</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-hide-delivered" ${p.hide_delivered ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
        </div>
      `;
    }

    if (activeTab === 'translate') {
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Dịch nhanh tin nhắn tại chỗ</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Bật tiện ích dịch nhanh</span>
              <span class="tadaza-item-desc">Hiện biểu tượng dịch cạnh từng tin nhắn</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-translate-enabled" ${tr.enabled ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Ngôn ngữ đích mặc định</span>
              <span class="tadaza-item-desc">Ngôn ngữ muốn dịch tin nhắn sang</span>
            </div>
            <select class="tadaza-select" id="select-target-lang">
              ${LANG_OPTIONS.map(opt => `<option value="${opt.code}" ${tr.target_lang === opt.code ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
          </div>

          <div class="tadaza-item tadaza-item-col">
            <span class="tadaza-item-title">Cách sử dụng:</span>
            <div class="tadaza-item-desc">
              1. Rê chuột vào bất kỳ tin nhắn nào trong cuộc trò chuyện.<br>
              2. Nhấn vào nút dịch thuật xuất hiện ở góc tin nhắn.<br>
              3. Bản dịch sẽ xuất hiện trực tiếp ngay dưới tin nhắn.
            </div>
          </div>
        </div>
      `;
    }

    if (activeTab === 'markdown') {
      const m = currentConfig.markdown || {};
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Hỗ trợ Markdown & Mã nguồn (Code)</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Bật hiển thị Code & Markdown</span>
              <span class="tadaza-item-desc">Tự động nhận diện block code \`\`\` và hiển thị dạng thẻ đẹp mắt</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-markdown-enabled" ${m.enabled ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!m.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tô màu cú pháp (Syntax Highlight)</span>
              <span class="tadaza-item-desc">Tô màu từ khóa, chuỗi, hàm cho JS, Python, Go, Rust, C++...</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-code-highlight" ${m.enabled && m.code_highlight ? 'checked' : ''} ${!m.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!m.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Định dạng chữ nội dòng (Inline)</span>
              <span class="tadaza-item-desc">Hỗ trợ \`code\`, **in đậm**, *nghiêng*, ~~gạch ngang~~</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-auto-format-inline" ${m.enabled && m.auto_format_inline ? 'checked' : ''} ${!m.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Code Studio nhanh</h3>
          <div class="tadaza-item tadaza-item-col">
            <button class="tadaza-action-btn" id="btn-open-code-studio" style="width: 100%; justify-content: center; height: 38px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
              <span style="font-weight: 600;">Mở Code & Markdown Studio (Ctrl+Shift+M)</span>
            </button>
            <div class="tadaza-item-desc" style="margin-top: 8px;">
              Tạo ảnh snippet phong cách macOS (Carbon) độ nét cao Retina 2x để gửi ngay vào Zalo hoặc chèn mã vào ô chat.
            </div>
          </div>
        </div>
      `;
    }

    if (activeTab === 'quick_parser') {
      const qp = currentConfig.quick_parser || {};
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Nhận diện & Trích xuất thông minh</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Bật Quick Parser</span>
              <span class="tadaza-item-desc">Tự động nhận diện STK ngân hàng, mã vận đơn, số điện thoại</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-qp-enabled" ${qp.enabled ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!qp.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Trích xuất STK & Tạo VietQR</span>
              <span class="tadaza-item-desc">Hiện nút tạo mã QR chuẩn VietQR (quét chuyển tiền ngay)</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-qp-bank" ${qp.enabled && qp.auto_detect_bank ? 'checked' : ''} ${!qp.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!qp.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tra cứu mã vận đơn</span>
              <span class="tadaza-item-desc">Tự động nhận diện đơn Shopee Express (SPX), GHTK, ViettelPost, J&T</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-qp-tracking" ${qp.enabled && qp.auto_detect_tracking ? 'checked' : ''} ${!qp.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!qp.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Nhận diện Số điện thoại</span>
              <span class="tadaza-item-desc">Hiện nút bấm 1-click Copy số điện thoại nhanh</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-qp-phone" ${qp.enabled && qp.auto_detect_phone ? 'checked' : ''} ${!qp.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Cách hoạt động</h3>
          <div class="tadaza-item tadaza-item-col">
            <div class="tadaza-item-desc">
              💳 <b>Chuyển khoản</b>: Khi ai đó gửi STK (ví dụ: <i>"ck tớ 150k vcb 0123456789"</i>), thẻ chuyển khoản sẽ hiện ngay dưới tin nhắn. Bấm <b>Tạo VietQR</b> để quét trên app ngân hàng điện thoại mà không cần gõ STK!<br><br>
              🚚 <b>Vận đơn</b>: Khi nhận mã Shopee/GHTK/ViettelPost, bấm <b>Tra cứu</b> để mở thẳng trang web theo dõi hành trình đơn hàng.
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  function bindTabEvents(drawer) {
    const saveAndApply = async (newPartial) => {
      currentConfig = {
        ...currentConfig,
        ...newPartial
      };
      applyTheme(currentConfig);
      await bridge.saveConfig(currentConfig);
    };

    if (activeTab === 'theme') {
      // Theme Mode buttons
      drawer.querySelectorAll('#group-theme-mode .tadaza-btn-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          drawer.querySelectorAll('#group-theme-mode .tadaza-btn-choice').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          saveAndApply({ theme: { ...currentConfig.theme, mode: btn.dataset.mode } });
        });
      });

      // Font select
      const selectFont = drawer.querySelector('#select-font');
      if (selectFont) {
        selectFont.addEventListener('change', () => {
          saveAndApply({ theme: { ...currentConfig.theme, font_family: selectFont.value } });
        });
      }

      // Font size slider
      const rangeFont = drawer.querySelector('#range-fontsize');
      const valFont = drawer.querySelector('#val-fontsize');
      if (rangeFont) {
        rangeFont.addEventListener('input', () => {
          valFont.textContent = `${rangeFont.value}px`;
        });
        rangeFont.addEventListener('change', () => {
          saveAndApply({ theme: { ...currentConfig.theme, font_size: parseInt(rangeFont.value, 10) } });
        });
      }

      // Choose wallpaper
      const btnChoose = drawer.querySelector('#btn-choose-wallpaper');
      if (btnChoose) {
        btnChoose.addEventListener('click', async () => {
          const res = await bridge.chooseWallpaper();
          if (res && !res.canceled && res.dataUri) {
            saveAndApply({ theme: { ...currentConfig.theme, wallpaper: res.dataUri } });
            renderDrawerContent();
          }
        });
      }

      // Clear wallpaper
      const btnClear = drawer.querySelector('#btn-clear-wallpaper');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          saveAndApply({ theme: { ...currentConfig.theme, wallpaper: '' } });
          renderDrawerContent();
        });
      }

      // Opacity slider
      const rangeOpacity = drawer.querySelector('#range-wallpaper-opacity');
      if (rangeOpacity) {
        rangeOpacity.addEventListener('change', () => {
          saveAndApply({ theme: { ...currentConfig.theme, wallpaper_opacity: parseFloat(rangeOpacity.value) } });
        });
      }
    }

    if (activeTab === 'privacy') {
      const antiPeeping = drawer.querySelector('#toggle-anti-peeping');
      const blurMsg = drawer.querySelector('#toggle-blur-messages');
      const blurMedia = drawer.querySelector('#toggle-blur-media');
      const blurNames = drawer.querySelector('#toggle-blur-names');
      const hideTyping = drawer.querySelector('#toggle-hide-typing');
      const hideSeen = drawer.querySelector('#toggle-hide-seen');
      const hideDelivered = drawer.querySelector('#toggle-hide-delivered');

      if (antiPeeping) {
        antiPeeping.addEventListener('change', () => {
          const enabled = antiPeeping.checked;
          currentConfig.privacy.anti_peeping = enabled;
          saveAndApply({ privacy: currentConfig.privacy });

          const subItems = drawer.querySelectorAll('.tadaza-item.sub-item');
          subItems.forEach(item => {
            if (enabled) {
              item.classList.remove('tadaza-item-disabled');
            } else {
              item.classList.add('tadaza-item-disabled');
            }
          });

          if (blurMsg) {
            blurMsg.disabled = !enabled;
            blurMsg.checked = enabled && !!currentConfig.privacy.blur_messages;
          }
          if (blurMedia) {
            blurMedia.disabled = !enabled;
            blurMedia.checked = enabled && !!currentConfig.privacy.blur_media;
          }
          if (blurNames) {
            blurNames.disabled = !enabled;
            blurNames.checked = enabled && !!currentConfig.privacy.blur_names;
          }
        });
      }

      if (blurMsg) {
        blurMsg.addEventListener('change', () => {
          currentConfig.privacy.blur_messages = blurMsg.checked;
          saveAndApply({ privacy: currentConfig.privacy });
        });
      }

      if (blurMedia) {
        blurMedia.addEventListener('change', () => {
          currentConfig.privacy.blur_media = blurMedia.checked;
          saveAndApply({ privacy: currentConfig.privacy });
        });
      }

      if (blurNames) {
        blurNames.addEventListener('change', () => {
          currentConfig.privacy.blur_names = blurNames.checked;
          saveAndApply({ privacy: currentConfig.privacy });
        });
      }

      if (hideTyping) {
        hideTyping.addEventListener('change', () => {
          saveAndApply({ privacy: { ...currentConfig.privacy, hide_typing: hideTyping.checked } });
        });
      }

      if (hideSeen) {
        hideSeen.addEventListener('change', () => {
          saveAndApply({ privacy: { ...currentConfig.privacy, hide_seen: hideSeen.checked } });
        });
      }

      if (hideDelivered) {
        hideDelivered.addEventListener('change', () => {
          saveAndApply({ privacy: { ...currentConfig.privacy, hide_delivered: hideDelivered.checked } });
        });
      }
    }

    if (activeTab === 'translate') {
      const transToggle = drawer.querySelector('#toggle-translate-enabled');
      const targetLang = drawer.querySelector('#select-target-lang');

      if (transToggle) {
        transToggle.addEventListener('change', () => {
          saveAndApply({ translate: { ...currentConfig.translate, enabled: transToggle.checked } });
        });
      }

      if (targetLang) {
        targetLang.addEventListener('change', () => {
          saveAndApply({ translate: { ...currentConfig.translate, target_lang: targetLang.value } });
        });
      }
    }

    if (activeTab === 'markdown') {
      const toggleMd = drawer.querySelector('#toggle-markdown-enabled');
      const toggleHl = drawer.querySelector('#toggle-code-highlight');
      const toggleInline = drawer.querySelector('#toggle-auto-format-inline');
      const btnOpenStudio = drawer.querySelector('#btn-open-code-studio');

      if (toggleMd) {
        toggleMd.addEventListener('change', () => {
          const enabled = toggleMd.checked;
          currentConfig.markdown.enabled = enabled;
          saveAndApply({ markdown: currentConfig.markdown });

          const subItems = drawer.querySelectorAll('.tadaza-item.sub-item');
          subItems.forEach(item => {
            if (enabled) item.classList.remove('tadaza-item-disabled');
            else item.classList.add('tadaza-item-disabled');
          });
          if (toggleHl) {
            toggleHl.disabled = !enabled;
            toggleHl.checked = enabled && !!currentConfig.markdown.code_highlight;
          }
          if (toggleInline) {
            toggleInline.disabled = !enabled;
            toggleInline.checked = enabled && !!currentConfig.markdown.auto_format_inline;
          }
        });
      }

      if (toggleHl) {
        toggleHl.addEventListener('change', () => {
          saveAndApply({ markdown: { ...currentConfig.markdown, code_highlight: toggleHl.checked } });
        });
      }

      if (toggleInline) {
        toggleInline.addEventListener('change', () => {
          saveAndApply({ markdown: { ...currentConfig.markdown, auto_format_inline: toggleInline.checked } });
        });
      }

      if (btnOpenStudio) {
        btnOpenStudio.addEventListener('click', () => {
          drawer.classList.remove('open');
          const overlay = document.getElementById('tadaza-overlay');
          if (overlay) overlay.classList.remove('open');
          const navBtn = document.getElementById('nav-item-tadaza');
          if (navBtn) navBtn.classList.remove('active');
          openCodeStudioModal();
        });
      }
    }

    if (activeTab === 'quick_parser') {
      const toggleQp = drawer.querySelector('#toggle-qp-enabled');
      const toggleBank = drawer.querySelector('#toggle-qp-bank');
      const toggleTrack = drawer.querySelector('#toggle-qp-tracking');
      const togglePhone = drawer.querySelector('#toggle-qp-phone');

      if (toggleQp) {
        toggleQp.addEventListener('change', () => {
          const enabled = toggleQp.checked;
          currentConfig.quick_parser.enabled = enabled;
          saveAndApply({ quick_parser: currentConfig.quick_parser });

          const subItems = drawer.querySelectorAll('.tadaza-item.sub-item');
          subItems.forEach(item => {
            if (enabled) item.classList.remove('tadaza-item-disabled');
            else item.classList.add('tadaza-item-disabled');
          });
          if (toggleBank) {
            toggleBank.disabled = !enabled;
            toggleBank.checked = enabled && !!currentConfig.quick_parser.auto_detect_bank;
          }
          if (toggleTrack) {
            toggleTrack.disabled = !enabled;
            toggleTrack.checked = enabled && !!currentConfig.quick_parser.auto_detect_tracking;
          }
          if (togglePhone) {
            togglePhone.disabled = !enabled;
            togglePhone.checked = enabled && !!currentConfig.quick_parser.auto_detect_phone;
          }
        });
      }

      if (toggleBank) {
        toggleBank.addEventListener('change', () => {
          saveAndApply({ quick_parser: { ...currentConfig.quick_parser, auto_detect_bank: toggleBank.checked } });
        });
      }

      if (toggleTrack) {
        toggleTrack.addEventListener('change', () => {
          saveAndApply({ quick_parser: { ...currentConfig.quick_parser, auto_detect_tracking: toggleTrack.checked } });
        });
      }

      if (togglePhone) {
        togglePhone.addEventListener('change', () => {
          saveAndApply({ quick_parser: { ...currentConfig.quick_parser, auto_detect_phone: togglePhone.checked } });
        });
      }
    }
  }

  /* --------------------------------------------------------------------------
     7. Initialization & Bridge Listeners
     -------------------------------------------------------------------------- */
  async function init() {
    setupNetworkHooks();

    try {
      const cfg = await bridge.getConfig();
      if (cfg) {
        currentConfig = { ...currentConfig, ...cfg };
      }
    } catch (e) {
      console.warn('[TADaZa] Failed to load config from bridge:', e);
    }

    applyTheme(currentConfig);

    // Watch OS Dark Mode changes in renderer
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (currentConfig.theme.mode === 'system') {
        currentConfig._systemIsDark = e.matches;
        applyTheme(currentConfig);
      }
    });

    // Listen for config changes from main process
    bridge.onConfigChanged((newCfg) => {
      currentConfig = { ...currentConfig, ...newCfg };
      applyTheme(currentConfig);
      renderDrawerContent();
    });

    // Mount UI when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        buildUI();
        setupMessageTranslator();
        setupMessageCodeFormatter();
        setupChatToolbarButton();
        setupInputMarkdownShortcuts();
        setupQuickParser();
      });
    } else {
      buildUI();
      setupMessageTranslator();
      setupMessageCodeFormatter();
      setupChatToolbarButton();
      setupInputMarkdownShortcuts();
      setupQuickParser();
    }
  }

  init();
})();
