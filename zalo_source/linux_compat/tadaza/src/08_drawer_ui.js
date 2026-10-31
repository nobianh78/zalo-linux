/* --------------------------------------------------------------------------
     8. Build TADaZa UI (Left Navigation Bar Button & Drawer Panel)
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
      if (!document.getElementById('nav-item-tadaza') || !document.getElementById('nav-item-tadaza-profiles')) {
        attachSidebarButton(toggleDrawer);
      }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });

    renderDrawerContent();
  }

  function attachSidebarButton(toggleDrawer) {
    const navBottom = document.querySelector('.nav__tabs__bottom');
    const navTop = document.querySelector('.nav__tabs__top');
    const navTabs = document.querySelector('.nav__tabs');

    // 1. TADaZa Settings Drawer Button
    if (!document.getElementById('nav-item-tadaza')) {
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

    // 2. Multi-Account Profiles Button
    if (!document.getElementById('nav-item-tadaza-profiles')) {
      const profBtn = document.createElement('div');
      profBtn.id = 'nav-item-tadaza-profiles';
      profBtn.className = 'nav__tabs__bottom__btn tadaza-nav-item';
      const curId = activeProfilesData.currentProfileId || 'default';
      const cur = (activeProfilesData.profiles || []).find(p => p.id === curId);
      const name = cur ? cur.name : 'Tài khoản Chính';
      profBtn.title = `Quản lý Đa tài khoản [${name}] (Chuyển đổi 1-click & Mở song song) [Ctrl+Shift+P]`;
      profBtn.innerHTML = `
        <svg class="tadaza-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      `;

      profBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const overlay = document.getElementById('tadaza-profiles-overlay');
        if (overlay && overlay.classList.contains('active')) {
          closeProfilesModal();
        } else {
          openProfilesModal();
        }
      });

      const tadazaItem = document.getElementById('nav-item-tadaza');
      if (tadazaItem && tadazaItem.parentElement) {
        tadazaItem.parentElement.insertBefore(profBtn, tadazaItem);
      } else if (navBottom && navBottom.lastElementChild) {
        navBottom.insertBefore(profBtn, navBottom.lastElementChild);
      } else if (navTop) {
        navTop.appendChild(profBtn);
      } else if (navTabs) {
        navTabs.appendChild(profBtn);
      }
    }
  }

  let activeTab = 'theme'; // see TADAZA_TABS

  const TADAZA_TABS = [
    { id: 'theme', label: 'Giao diện', title: 'Giao diện',
      icon: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' },
    { id: 'privacy', label: 'Riêng tư', title: 'Riêng tư',
      icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    { id: 'translate', label: 'Dịch nhanh', title: 'Dịch tin nhắn',
      icon: '<path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>' },
    { id: 'markdown', label: 'Markdown', title: 'Markdown & Code',
      icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
    { id: 'quick_parser', label: 'VietQR & Vận đơn', title: 'Nhận diện thông minh',
      icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' },
    { id: 'floating_chat', label: 'Chat nổi', title: 'Bong bóng chat nổi',
      icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
    { id: 'profiles', label: 'Tài khoản', title: 'Đa tài khoản',
      icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { id: 'system', label: 'Hệ thống', title: 'Hệ thống & Linux',
      icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' }
  ];

  function renderDrawerContent() {
    const drawer = document.getElementById('tadaza-drawer');
    if (!drawer) return;

    if (activeTab === 'features') activeTab = 'theme';

    const t = currentConfig.theme;
    const p = currentConfig.privacy;
    const tr = currentConfig.translate;

    const tabDef = TADAZA_TABS.find(x => x.id === activeTab) || TADAZA_TABS[0];

    drawer.innerHTML = `
      <div class="tadaza-sidebar">
        <div class="tadaza-brand">
          <div class="tadaza-brand-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 11a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2 2 2 0 0 1 4 0 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 1 0 4 2 2 0 0 0-2 2v1a2 2 0 0 1-2 2h-1a2 2 0 0 0-2 2 2 2 0 0 1-4 0 2 2 0 0 0-2-2H6a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2z"/>
            </svg>
          </div>
          <div class="tadaza-brand-text">
            <span class="tadaza-brand-name">TADaZa</span>
            <span class="tadaza-brand-sub">Tiện ích Zalo Linux</span>
          </div>
        </div>
        <div class="tadaza-tabs">
          ${TADAZA_TABS.map(tab => `
            <button class="tadaza-tab-btn ${activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}" title="${tab.title}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${tab.icon}</svg>
              <span>${tab.label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="tadaza-main">
        <div class="tadaza-header">
          <h2 class="tadaza-title">${tabDef.title}</h2>
          <button class="tadaza-close-btn" id="tadaza-close" title="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="tadaza-content">
          ${renderTabContent()}
        </div>
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
    const sys = currentConfig.system || {};
    const f = currentConfig.features;

    if (activeTab === 'theme') {
      const activePreset = t.active_preset || (t.hawaiian_theme ? 'hawaiian' : 'none');
      const themeOpacity = t.theme_opacity !== undefined ? t.theme_opacity : (t.hawaiian_opacity !== undefined ? t.hawaiian_opacity : 0.85);
      const themeFps = t.theme_fps || t.hawaiian_fps || 20;
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Chế độ màu</h3>
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
                <span>Tối</span>
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
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Phông chữ</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Kiểu chữ</span>
            </div>
            <select class="tadaza-select" id="select-font">
              ${FONT_OPTIONS.map(opt => `<option value="${opt.value}" ${t.font_family === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
          </div>

          <div class="tadaza-item tadaza-item-col">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Cỡ chữ tin nhắn</span>
            </div>
            <div class="tadaza-range-wrap">
              <input type="range" class="tadaza-range" id="range-fontsize" min="12" max="22" value="${t.font_size || 14}">
              <span class="tadaza-range-val" id="val-fontsize">${t.font_size || 14}px</span>
            </div>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Hình nền trò chuyện</h3>
          <div class="tadaza-item tadaza-item-col">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="tadaza-action-btn" id="btn-choose-wallpaper">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Chọn ảnh…</span>
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

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">
            <span>Nền động</span>
            <span class="tadaza-pill live">LIVE</span>
          </h3>
          <div class="tadaza-item-desc">Hoạt ảnh ASCII phía sau khung chat, tự giảm FPS khi Zalo không được chọn.</div>

          <div class="tadaza-theme-grid" id="tadaza-theme-presets-grid">
            ${[
              ['hawaiian', '🏝️', 'Hawaiian Lagoon', 'Đại dương'],
              ['koi', '🎏', 'Hồ Sen Cá Koi', 'Hồ sen'],
              ['galaxy', '🚀', 'Dải Ngân Hà', 'Vũ trụ'],
              ['arctic', '🐧', 'Bắc Cực', 'Băng tuyết'],
              ['spring', '🌸', 'Mùa Xuân', 'Hoa đào'],
              ['none', '⚪', 'Mặc định', 'Tắt']
            ].map(([id, icon, name, tag]) => `
              <div class="tadaza-theme-card ${activePreset === id || (id === 'koi' && activePreset === 'rainforest') || (id === 'galaxy' && activePreset === 'bioforest') ? 'active' : ''}" data-preset="${id}">
                <div class="tadaza-theme-preview ${id}">${icon}</div>
                <div class="tadaza-theme-card-title">
                  <span>${name}</span>
                  <span class="tadaza-theme-card-tag">${tag}</span>
                </div>
              </div>
            `).join('')}
          </div>

          ${activePreset !== 'none' ? `
            <div class="tadaza-item tadaza-item-col">
              <div class="tadaza-item-info">
                <span class="tadaza-item-title">Độ rõ hình nền</span>
                <span class="tadaza-item-desc">Độ mờ / trong suốt của hoạt ảnh nền</span>
              </div>
              <div class="tadaza-range-wrap">
                <input type="range" class="tadaza-range" id="range-dynamic-theme-opacity" min="0.3" max="1" step="0.05" value="${themeOpacity}">
                <span class="tadaza-range-val">${Math.round(themeOpacity * 100)}%</span>
              </div>
            </div>

            <div class="tadaza-item">
              <div class="tadaza-item-info">
                <span class="tadaza-item-title">Tốc độ khung hình</span>
                <span class="tadaza-item-desc">Giảm còn 5 FPS khi chuyển sang cửa sổ khác</span>
              </div>
              <select class="tadaza-select" id="select-dynamic-theme-fps">
                <option value="15" ${themeFps === 15 ? 'selected' : ''}>15 FPS (mát máy)</option>
                <option value="20" ${themeFps === 20 ? 'selected' : ''}>20 FPS (khuyên dùng)</option>
                <option value="30" ${themeFps === 30 ? 'selected' : ''}>30 FPS (mượt nhất)</option>
                <option value="10" ${themeFps === 10 ? 'selected' : ''}>10 FPS (tiết kiệm pin)</option>
              </select>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (activeTab === 'privacy') {
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Chống nhìn trộm</h3>
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

    if (activeTab === 'system') {
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Cửa sổ & cập nhật</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Thu nhỏ xuống khay khi đóng</span>
              <span class="tadaza-item-desc">Bấm X sẽ ẩn Zalo xuống khay hệ thống thay vì thoát hẳn</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-close-to-tray" ${(currentConfig.system && currentConfig.system.close_to_tray) ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Kiểm tra cập nhật</span>
              <span class="tadaza-item-desc" id="tadaza-update-status">Kiểm tra phiên bản mới nhất từ GitHub Releases</span>
            </div>
            <button class="tadaza-action-btn secondary" id="btn-check-update">
              Kiểm tra ngay
            </button>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Bộ gõ & hiển thị</h3>
          <div class="tadaza-item tadaza-item-col">
            <ul class="tadaza-diag" id="tadaza-linux-diag"><li class="info"><span class="dot"></span><span>Đang kiểm tra…</span></li></ul>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Chế độ hiển thị</span>
              <span class="tadaza-item-desc">X11 gõ tiếng Việt ổn định. Wayland gốc nét hơn nhưng không gõ được tiếng Việt trên GNOME.</span>
            </div>
            <select class="tadaza-select" id="select-display-mode">
              <option value="x11" ${sys.display_mode !== 'wayland' ? 'selected' : ''}>X11 (khuyên dùng)</option>
              <option value="wayland" ${sys.display_mode === 'wayland' ? 'selected' : ''}>Wayland gốc (thử nghiệm)</option>
            </select>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tỉ lệ hiển thị (HiDPI)</span>
              <span class="tadaza-item-desc">Dùng khi chữ bị mờ hoặc quá nhỏ trên màn hình scale lẻ</span>
            </div>
            <select class="tadaza-select" id="select-scale-factor">
              ${[0, 1, 1.25, 1.5, 1.75, 2].map(v => `<option value="${v}" ${Number(sys.scale_factor || 0) === v ? 'selected' : ''}>${v === 0 ? 'Tự động' : Math.round(v * 100) + '%'}</option>`).join('')}
            </select>
          </div>


          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Số tin chưa đọc trên Dock &amp; khay</span>
              <span class="tadaza-item-desc">Ubuntu Dock, Dash to Dock, KDE Plasma và khay hệ thống</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-unread-badge" ${sys.unread_badge !== false ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Thêm cảm xúc</span>
              <span class="tadaza-item-desc">18 cảm xúc thay vì 6 (👌 🙏 🌹 💔 👏 …), điện thoại vẫn thấy được</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-extra-reactions" ${sys.extra_reactions !== false ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
          <div class="tadaza-item" id="tadaza-relaunch-row" hidden>
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Cần khởi động lại</span>
              <span class="tadaza-item-desc">Thay đổi hiển thị có hiệu lực sau khi mở lại Zalo</span>
            </div>
            <button class="tadaza-action-btn" id="btn-relaunch-zalo" >
              Khởi động lại
            </button>
          </div>
        </div>
      `;
    }

    if (activeTab === 'translate') {
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Dịch tại chỗ</h3>
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

        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Cách dùng</h3>
          <div class="tadaza-item tadaza-item-col">
            <ol class="tadaza-steps tadaza-item-desc">
              <li>Rê chuột vào tin nhắn bất kỳ</li>
              <li>Bấm nút dịch ở góc tin nhắn</li>
              <li>Bản dịch hiện ngay bên dưới</li>
            </ol>
          </div>
        </div>
      `;
    }

    if (activeTab === 'markdown') {
      const m = currentConfig.markdown || {};
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Hiển thị</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Hiển thị Markdown & code</span>
              <span class="tadaza-item-desc">Tự động nhận diện block code \`\`\` và hiển thị dạng thẻ đẹp mắt</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-markdown-enabled" ${m.enabled ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!m.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tô màu cú pháp</span>
              <span class="tadaza-item-desc">Tô màu từ khóa, chuỗi, hàm cho JS, Python, Go, Rust, C++...</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-code-highlight" ${m.enabled && m.code_highlight ? 'checked' : ''} ${!m.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!m.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Định dạng trong dòng</span>
              <span class="tadaza-item-desc">Hỗ trợ \`code\`, **in đậm**, *nghiêng*, ~~gạch ngang~~</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-auto-format-inline" ${m.enabled && m.auto_format_inline ? 'checked' : ''} ${!m.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Code Studio</h3>
          <div class="tadaza-item tadaza-item-col">
            <button class="tadaza-action-btn block" id="btn-open-code-studio">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
              <span>Mở Code Studio</span><span style="opacity:.7; font-weight:500;">Ctrl+Shift+M</span>
            </button>
            <div class="tadaza-item-desc">
              Tạo ảnh code đẹp (độ nét 2x) để gửi vào Zalo, hoặc chèn code vào ô chat.
            </div>
          </div>
        </div>
      `;
    }

    if (activeTab === 'quick_parser') {
      const qp = currentConfig.quick_parser || {};
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Tự động nhận diện</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Bật nhận diện thông minh</span>
              <span class="tadaza-item-desc">Tự động nhận diện STK ngân hàng, mã vận đơn, số điện thoại</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-qp-enabled" ${qp.enabled ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!qp.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Số tài khoản → VietQR</span>
              <span class="tadaza-item-desc">Tạo mã QR chuyển khoản từ STK trong tin nhắn</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-qp-bank" ${qp.enabled && qp.auto_detect_bank ? 'checked' : ''} ${!qp.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!qp.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Mã vận đơn</span>
              <span class="tadaza-item-desc">SPX, GHTK, ViettelPost, J&T — bấm để tra cứu</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-qp-tracking" ${qp.enabled && qp.auto_detect_tracking ? 'checked' : ''} ${!qp.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!qp.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Số điện thoại</span>
              <span class="tadaza-item-desc">Hiện nút sao chép nhanh</span>
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

    if (activeTab === 'floating_chat') {
      const fc = currentConfig.floating_chat || {};
      const conv = getActiveConversation();
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Bong bóng chat</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Bật bong bóng chat nổi</span>
              <span class="tadaza-item-desc">Thêm nút ghim trên thanh tiêu đề cuộc trò chuyện</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-fc-enabled" ${fc.enabled ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!fc.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tự thu nhỏ khi rời cửa sổ</span>
              <span class="tadaza-item-desc">Thu về bong bóng tròn khi chuyển sang ứng dụng khác</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-fc-auto-collapse" ${fc.enabled && fc.auto_collapse_blur ? 'checked' : ''} ${!fc.enabled ? 'disabled' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Thao tác nhanh</h3>
          <div class="tadaza-item tadaza-item-col">
            <button class="tadaza-action-btn block" id="btn-pin-current-chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                <circle cx="12" cy="12" r="3" fill="#89b4fa" stroke="none"></circle>
              </svg>
              <span>Ghim cuộc trò chuyện hiện tại</span>
            </button>
            <div class="tadaza-item-desc">
              ${conv ? `Đang mở: <b>${escapeHtml(conv.name)}</b>` : 'Mở một cuộc trò chuyện để ghim ra màn hình.'}
            </div>
          </div>
        </div>
      `;
    }

    if (activeTab === 'profiles') {
      const curId = activeProfilesData.currentProfileId || 'default';
      const cur = (activeProfilesData.profiles || []).find(p => p.id === curId);
      const curName = cur ? cur.name : 'Tài khoản Chính';

      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Đang dùng</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">${escapeHtml(curName)}</span>
              <span class="tadaza-item-desc">Mỗi tài khoản có dữ liệu và phiên đăng nhập riêng</span>
            </div>
            <span class="tadaza-pill success"><span class="profile-dot"></span>Đang chạy</span>
          </div>
          <div class="tadaza-item tadaza-item-col">
            <button class="tadaza-action-btn block" id="btn-open-profiles-modal-from-drawer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Quản lý tài khoản</span><span style="opacity:.7; font-weight:500;">Ctrl+Shift+P</span>
            </button>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Có thể làm gì</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Chuyển tài khoản</span>
              <span class="tadaza-item-desc">Khởi động lại vào tài khoản khác trong vài giây, tin nhắn tách biệt</span>
            </div>
          </div>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Mở song song</span>
              <span class="tadaza-item-desc">Chạy nhiều cửa sổ Zalo cùng lúc, mỗi cửa sổ một tài khoản</span>
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

    const openProfilesBtn = drawer.querySelector('#btn-open-profiles-modal-from-drawer');
    if (openProfilesBtn) {
      openProfilesBtn.addEventListener('click', () => {
        drawer.classList.remove('open');
        const overlay = document.getElementById('tadaza-overlay');
        if (overlay) overlay.classList.remove('open');
        const navBtn = document.getElementById('nav-item-tadaza');
        if (navBtn) navBtn.classList.remove('active');
        openProfilesModal();
      });
    }

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

      // Dynamic Theme Preset Card Selection
      const themeCards = drawer.querySelectorAll('.tadaza-theme-card');
      themeCards.forEach(card => {
        card.addEventListener('click', () => {
          const preset = card.getAttribute('data-preset');
          const isHawaiian = (preset === 'hawaiian');
          currentConfig.theme.active_preset = preset;
          currentConfig.theme.hawaiian_theme = isHawaiian;
          saveAndApply({
            theme: {
              ...currentConfig.theme,
              active_preset: preset,
              hawaiian_theme: isHawaiian
            }
          });
          renderDrawerContent();
        });
      });

      // Dynamic Theme Opacity
      const rangeDynamicOpacity = drawer.querySelector('#range-dynamic-theme-opacity');
      if (rangeDynamicOpacity) {
        const valSpan = rangeDynamicOpacity.parentElement?.querySelector('.tadaza-range-val');
        rangeDynamicOpacity.addEventListener('input', () => {
          if (valSpan) {
            valSpan.textContent = `${Math.round(parseFloat(rangeDynamicOpacity.value) * 100)}%`;
          }
        });
        rangeDynamicOpacity.addEventListener('change', () => {
          const val = parseFloat(rangeDynamicOpacity.value);
          currentConfig.theme.theme_opacity = val;
          currentConfig.theme.hawaiian_opacity = val;
          saveAndApply({
            theme: {
              ...currentConfig.theme,
              theme_opacity: val,
              hawaiian_opacity: val
            }
          });
        });
      }

      // Dynamic Theme FPS
      const selectDynamicFps = drawer.querySelector('#select-dynamic-theme-fps');
      if (selectDynamicFps) {
        selectDynamicFps.addEventListener('change', () => {
          const fps = parseInt(selectDynamicFps.value, 10);
          currentConfig.theme.theme_fps = fps;
          currentConfig.theme.hawaiian_fps = fps;
          saveAndApply({
            theme: {
              ...currentConfig.theme,
              theme_fps: fps,
              hawaiian_fps: fps
            }
          });
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

    if (activeTab === 'system') {
      const closeToTray = drawer.querySelector('#toggle-close-to-tray');
      if (closeToTray) {
        closeToTray.addEventListener('change', () => {
          if (!currentConfig.system) currentConfig.system = {};
          currentConfig.system.close_to_tray = closeToTray.checked;
          saveAndApply({ system: currentConfig.system });
        });
      }

      const btnCheckUpdate = drawer.querySelector('#btn-check-update');
      const updateStatus = drawer.querySelector('#tadaza-update-status');
      if (btnCheckUpdate) {
        btnCheckUpdate.addEventListener('click', async () => {
          if (updateStatus) updateStatus.textContent = 'Đang kiểm tra từ GitHub...';
          btnCheckUpdate.disabled = true;
          try {
            await window.electronAPI.invoke('tadaza:check-for-updates', false);
            if (updateStatus) updateStatus.textContent = 'Đã kiểm tra xong!';
          } catch (e) {
            if (updateStatus) updateStatus.textContent = 'Lỗi: ' + e.message;
          } finally {
            btnCheckUpdate.disabled = false;
          }
        });
      }

      // Linux: input method / display backend / badge
      const diagEl = drawer.querySelector('#tadaza-linux-diag');
      if (diagEl && window.electronAPI && window.electronAPI.invoke) {
        const row = (cls, text) => `<li class="${cls}"><span class="dot"></span><span>${escapeHtml(text)}</span></li>`;
        window.electronAPI.invoke('tadaza:linux-diagnostics').then(d => {
          if (!d || d.error) {
            diagEl.innerHTML = row('warn', 'Không đọc được thông tin hệ thống' + (d && d.error ? ': ' + d.error : ''));
            return;
          }
          const imName = d.inputMethod === 'fcitx' ? 'Fcitx5' : d.inputMethod === 'ibus' ? 'IBus' : null;
          const items = [
            row('ok', `Phiên ${d.session === 'wayland' ? 'Wayland' : 'X11'}${d.desktop ? ' (' + d.desktop + ')' : ''} — Zalo chạy ${d.displayMode === 'wayland' ? 'Wayland gốc' : 'X11'}`),
            imName
              ? row(d.gtkImModuleFound === false ? 'warn' : 'ok', `Bộ gõ ${imName} — GTK_IM_MODULE=${d.gtkImModule || 'mặc định'}`)
              : row('warn', 'Chưa thấy bộ gõ — cài ibus-bamboo, ibus-unikey hoặc fcitx5-unikey'),
            row('ok', d.pipewireCapture ? 'Chia sẻ màn hình qua PipeWire' : 'Chia sẻ màn hình qua X11'),
            row('info', `Badge dock: ${d.desktopFileId || '?'}${d.scaleFactor ? ' · tỉ lệ ' + Math.round(d.scaleFactor * 100) + '%' : ''}`)
          ].concat((d.warnings || []).map(w => row('warn', w)));
          diagEl.innerHTML = items.join('');
        }).catch(e => {
          diagEl.innerHTML = row('warn', 'Không đọc được thông tin hệ thống: ' + e.message);
        });
      }

      const relaunchRow = drawer.querySelector('#tadaza-relaunch-row');
      const showRelaunch = () => { if (relaunchRow) relaunchRow.hidden = false; };

      const displayMode = drawer.querySelector('#select-display-mode');
      if (displayMode) {
        displayMode.addEventListener('change', () => {
          saveAndApply({ system: { ...(currentConfig.system || {}), display_mode: displayMode.value } });
          showRelaunch();
        });
      }

      const scaleFactor = drawer.querySelector('#select-scale-factor');
      if (scaleFactor) {
        scaleFactor.addEventListener('change', () => {
          saveAndApply({ system: { ...(currentConfig.system || {}), scale_factor: Number(scaleFactor.value) || 0 } });
          showRelaunch();
        });
      }

      const unreadBadge = drawer.querySelector('#toggle-unread-badge');
      if (unreadBadge) {
        unreadBadge.addEventListener('change', () => {
          saveAndApply({ system: { ...(currentConfig.system || {}), unread_badge: unreadBadge.checked } });
        });
      }

      const extraReactions = drawer.querySelector('#toggle-extra-reactions');
      if (extraReactions) {
        extraReactions.addEventListener('change', () => {
          saveAndApply({ system: { ...(currentConfig.system || {}), extra_reactions: extraReactions.checked } });
          applyExtraReactions();
        });
      }

      const btnRelaunch = drawer.querySelector('#btn-relaunch-zalo');
      if (btnRelaunch) {
        btnRelaunch.addEventListener('click', () => {
          btnRelaunch.disabled = true;
          window.electronAPI.invoke('tadaza:relaunch').catch(() => { btnRelaunch.disabled = false; });
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

    if (activeTab === 'floating_chat') {
      const toggleFcEnabled = drawer.querySelector('#toggle-fc-enabled');
      const toggleFcAutoCollapse = drawer.querySelector('#toggle-fc-auto-collapse');
      const btnPin = drawer.querySelector('#btn-pin-current-chat');

      if (toggleFcEnabled) {
        toggleFcEnabled.addEventListener('change', () => {
          saveAndApply({ floating_chat: { ...currentConfig.floating_chat, enabled: toggleFcEnabled.checked } });
          renderDrawerContent();
        });
      }

      if (toggleFcAutoCollapse) {
        toggleFcAutoCollapse.addEventListener('change', () => {
          saveAndApply({ floating_chat: { ...currentConfig.floating_chat, auto_collapse_blur: toggleFcAutoCollapse.checked } });
        });
      }

      if (btnPin) {
        btnPin.addEventListener('click', async () => {
          const conv = getActiveConversation();
          if (!conv) {
            alert('Vui lòng mở một cuộc trò chuyện trước khi ghim!');
            return;
          }
          const messages = scrapeCurrentMessages();
          if (bridge.pinChatHead) {
            await bridge.pinChatHead({
              id: conv.id,
              name: conv.name,
              avatar: conv.avatar,
              messages
            });
          }
          pinnedChatIds.add(conv.id);
          const headerBtn = document.getElementById('tadaza-btn-pin-chathead');
          if (headerBtn) headerBtn.classList.add('pinned');
          drawer.classList.remove('open');
          document.getElementById('tadaza-overlay').classList.remove('open');
        });
      }
    }
  }
