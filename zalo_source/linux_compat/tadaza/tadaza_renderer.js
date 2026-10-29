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
    features: {
      extended_reactions: true
    },
    _systemIsDark: false
  };

  const EMOJI_LIST = [
    '👍', '❤️', '😂', '😮', '😭', '😡', '🙏', '🔥',
    '👏', '🎉', '🥰', '😍', '🤩', '😘', '😋', '😎',
    '🤔', '🤫', '🤭', '😏', '🙄', '😬', '🤥', '😌',
    '😴', '😷', '🤕', '🤮', '🤧', '🥵', '🥶', '🤯',
    '🥳', '🥺', '😱', '😈', '💀', '💩', '👻', '🤖',
    '💖', '💕', '💔', '✨', '🌟', '💡', '🚀', '🎯',
    '☕', '🍻', '💯', '✔️', '❌', '⚠️', '⭐', '🍀',
    '🤝', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '💪',
    '👈', '👉', '👆', '👇', '✋', '👋', '🤙', '🎈',
    '🎁', '🎂', '🍕', '🍔', '🍦', '🍩', '🥑', '🍎'
  ];

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

  /* --------------------------------------------------------------------------
     1. Network Hooks for Privacy (Typing, Seen, Delivered)
     -------------------------------------------------------------------------- */
  function setupNetworkHooks() {
    // Intercept WebSocket send
    const origWsSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      if (typeof data === 'string') {
        if (currentConfig.privacy.hide_typing && /"typing"|typing_status|is_typing/i.test(data)) {
          return;
        }
        if (currentConfig.privacy.hide_seen && /"seen"|ack_seen|read_msg/i.test(data)) {
          return;
        }
        if (currentConfig.privacy.hide_delivered && /"delivered"|ack_delivered|recv_msg/i.test(data)) {
          return;
        }
      }
      return origWsSend.apply(this, arguments);
    };

    // Intercept Fetch requests
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      if (init && init.body && typeof init.body === 'string') {
        if (currentConfig.privacy.hide_typing && /"typing"|typing_status|is_typing/i.test(init.body)) {
          return Promise.resolve(new Response(JSON.stringify({ error_code: 0 })));
        }
        if (currentConfig.privacy.hide_seen && /"seen"|ack_seen|read_msg/i.test(init.body)) {
          return Promise.resolve(new Response(JSON.stringify({ error_code: 0 })));
        }
        if (currentConfig.privacy.hide_delivered && /"delivered"|ack_delivered|recv_msg/i.test(init.body)) {
          return Promise.resolve(new Response(JSON.stringify({ error_code: 0 })));
        }
      }
      return origFetch.apply(this, arguments);
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
        const textToTranslate = (msgElem.innerText || '').trim();
        if (!textToTranslate) return;

        const container = msgElem.closest('.chat-message, [class*="msg-item"], [class*="bubble-content"]') || msgElem.parentElement;
        let oldBox = container ? container.querySelector('.tadaza-trans-box') : null;
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
                <span style="cursor:pointer;" class="trans-close">✕</span>
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

            if (container) {
              container.appendChild(box);
            } else {
              msgElem.parentElement.appendChild(box);
            }
          }
        } catch (err) {
          hoverBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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

      const bubble = e.target.closest && (
        e.target.closest('[class*="bubble-content"]') ||
        e.target.closest('[class*="msg-content"]') ||
        e.target.closest('[class*="message-content"]')
      );

      if (bubble && bubble.innerText && bubble.innerText.trim().length > 0) {
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
     4. Build TADaZa UI (Left Navigation Bar Button & Drawer Panel)
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

  let activeTab = 'theme'; // 'theme' | 'privacy' | 'translate' | 'features'

  function renderDrawerContent() {
    const drawer = document.getElementById('tadaza-drawer');
    if (!drawer) return;

    const t = currentConfig.theme;
    const p = currentConfig.privacy;
    const tr = currentConfig.translate;
    const f = currentConfig.features;

    drawer.innerHTML = `
      <div class="tadaza-header">
        <div class="tadaza-title-wrap">
          <span class="tadaza-badge">LINUX</span>
          <h2 class="tadaza-title">TADaZa Control Center</h2>
        </div>
        <button class="tadaza-close-btn" id="tadaza-close">✕</button>
      </div>

      <div class="tadaza-tabs">
        <button class="tadaza-tab-btn ${activeTab === 'theme' ? 'active' : ''}" data-tab="theme">
          <span>🎨</span>
          <span>Giao diện</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'privacy' ? 'active' : ''}" data-tab="privacy">
          <span>🔒</span>
          <span>Riêng tư</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'translate' ? 'active' : ''}" data-tab="translate">
          <span>🌐</span>
          <span>Dịch thuật</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'features' ? 'active' : ''}" data-tab="features">
          <span>😀</span>
          <span>Tiện ích</span>
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
              <button class="tadaza-btn-choice ${t.mode === 'light' ? 'active' : ''}" data-mode="light">☀️ Sáng</button>
              <button class="tadaza-btn-choice ${t.mode === 'dark' ? 'active' : ''}" data-mode="dark">🌙 Tối (Dark)</button>
              <button class="tadaza-btn-choice ${t.mode === 'system' ? 'active' : ''}" data-mode="system">💻 Hệ thống</button>
            </div>
            <div class="tadaza-item-desc">Đồng bộ tự động theo theme tối của GNOME/KDE hoặc chọn màu tối chuyên sâu.</div>
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
              <button class="tadaza-action-btn" id="btn-choose-wallpaper">🖼️ Chọn ảnh nền từ máy</button>
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

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Làm mờ tin nhắn văn bản</span>
              <span class="tadaza-item-desc">Làm mờ toàn bộ nội dung chat</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-blur-messages" ${p.blur_messages ? 'checked' : ''} ${!p.anti_peeping ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Làm mờ hình ảnh & video</span>
              <span class="tadaza-item-desc">Bảo vệ hình ảnh nhạy cảm khi ở nơi công cộng</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-blur-media" ${p.blur_media ? 'checked' : ''} ${!p.anti_peeping ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Làm mờ tên & Avatar người gửi</span>
              <span class="tadaza-item-desc">Giữ kín danh tính người đang nhắn</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-blur-names" ${p.blur_names ? 'checked' : ''} ${!p.anti_peeping ? 'disabled' : ''}>
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
              2. Nhấn vào biểu tượng 🌐 hiển thị cạnh nội dung.<br>
              3. Bản dịch sẽ xuất hiện trực tiếp ngay dưới tin nhắn.
            </div>
          </div>
        </div>
      `;
    }

    if (activeTab === 'features') {
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Kho Emoji & Phản ứng mở rộng (80+)</h3>
          <div class="tadaza-item-desc">Nhấn vào biểu tượng emoji bên dưới để sao chép nhanh hoặc dán vào khung chat:</div>
          <div class="tadaza-emoji-grid">
            ${EMOJI_LIST.map(emoji => `<div class="tadaza-emoji-item" data-emoji="${emoji}">${emoji}</div>`).join('')}
          </div>
          <div id="tadaza-emoji-copied" style="font-size:12px; color:#0068ff; font-weight:600; text-align:center; height:18px;"></div>
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
          if (blurMsg) blurMsg.disabled = !enabled;
          if (blurMedia) blurMedia.disabled = !enabled;
          if (blurNames) blurNames.disabled = !enabled;
          saveAndApply({ privacy: { ...currentConfig.privacy, anti_peeping: enabled } });
        });
      }

      if (blurMsg) {
        blurMsg.addEventListener('change', () => {
          saveAndApply({ privacy: { ...currentConfig.privacy, blur_messages: blurMsg.checked } });
        });
      }

      if (blurMedia) {
        blurMedia.addEventListener('change', () => {
          saveAndApply({ privacy: { ...currentConfig.privacy, blur_media: blurMedia.checked } });
        });
      }

      if (blurNames) {
        blurNames.addEventListener('change', () => {
          saveAndApply({ privacy: { ...currentConfig.privacy, blur_names: blurNames.checked } });
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

    if (activeTab === 'features') {
      const grid = drawer.querySelector('.tadaza-emoji-grid');
      const feedback = drawer.querySelector('#tadaza-emoji-copied');
      if (grid) {
        grid.querySelectorAll('.tadaza-emoji-item').forEach(item => {
          item.addEventListener('click', () => {
            const emoji = item.dataset.emoji;
            navigator.clipboard.writeText(emoji);

            // Attempt to insert directly into active chat input if focused
            const input = document.querySelector('[contenteditable="true"]') || document.querySelector('input:focus');
            if (input) {
              if (input.isContentEditable) {
                input.focus();
                document.execCommand('insertText', false, emoji);
              } else {
                input.value += emoji;
              }
            }

            if (feedback) {
              feedback.textContent = `Đã sao chép: ${emoji}`;
              setTimeout(() => {
                if (feedback) feedback.textContent = '';
              }, 1500);
            }
          });
        });
      }
    }
  }

  /* --------------------------------------------------------------------------
     5. Initialization & Bridge Listeners
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
      });
    } else {
      buildUI();
      setupMessageTranslator();
    }
  }

  init();
})();
