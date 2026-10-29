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
        <button class="tadaza-tab-btn ${activeTab === 'floating_chat' ? 'active' : ''}" data-tab="floating_chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            <circle cx="12" cy="12" r="3" fill="#89b4fa" stroke="none"></circle>
          </svg>
          <span>Chat Head nổi</span>
        </button>
        <button class="tadaza-tab-btn ${activeTab === 'profiles' ? 'active' : ''}" data-tab="profiles">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Đa tài khoản</span>
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

    if (activeTab === 'floating_chat') {
      const fc = currentConfig.floating_chat || {};
      const conv = getActiveConversation();
      return `
        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Bong bóng chat rời (Desktop Floating PiP)</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Bật Bong bóng chat rời</span>
              <span class="tadaza-item-desc">Hiện biểu tượng ghim Chat Head trên thanh tiêu đề cuộc trò chuyện</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-fc-enabled" ${fc.enabled ? 'checked' : ''}>
              <span class="tadaza-slider"></span>
            </label>
          </div>

          <div class="tadaza-item sub-item ${!fc.enabled ? 'tadaza-item-disabled' : ''}">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tự động thu nhỏ khi click ra ngoài</span>
              <span class="tadaza-item-desc">Tự động thu về bong bóng tròn nhỏ khi chuyển sang ứng dụng khác</span>
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
            <button class="tadaza-action-btn" id="btn-pin-current-chat" style="width: 100%; justify-content: center; height: 38px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                <circle cx="12" cy="12" r="3" fill="#89b4fa" stroke="none"></circle>
              </svg>
              <span style="font-weight: 600;">Ghim cuộc trò chuyện hiện tại ra Bong bóng</span>
            </button>
            <div class="tadaza-item-desc" style="margin-top: 8px;">
              ${conv ? `Đang mở: <b>${escapeHtml(conv.name)}</b>` : 'Hãy mở một cuộc trò chuyện để ghim nhanh ra góc màn hình desktop!'}
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
          <h3 class="tadaza-section-title">Hệ thống Đa tài khoản (Profiles)</h3>
          <div class="tadaza-item tadaza-item-col">
            <div class="tadaza-item-desc" style="line-height: 1.6;">
              Lưu trữ nhiều phiên đăng nhập Zalo độc lập (Tài khoản cá nhân, Tài khoản bán hàng, Công việc) ngay trên ứng dụng máy tính, không cần mở Zalo Web trên trình duyệt.
            </div>
            <div style="margin-top: 10px; padding: 10px 14px; border-radius: 10px; background: rgba(0, 104, 255, 0.08); border: 1px solid rgba(0, 104, 255, 0.2); display: flex; align-items: center; justify-content: space-between;">
              <div style="font-size: 13px;">Tài khoản hiện tại: <b style="color: #0068ff;">${escapeHtml(curName)}</b></div>
              <span class="tadaza-profile-badge-active"><span class="profile-dot"></span> Đang chạy</span>
            </div>
            <button class="tadaza-action-btn" id="btn-open-profiles-modal-from-drawer" style="width: 100%; justify-content: center; height: 40px; margin-top: 12px; font-weight: 600; background: #0068ff; color: white;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Mở Bảng Quản lý Đa tài khoản</span>
            </button>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Tính năng nổi bật</h3>
          <div class="tadaza-item tadaza-item-col">
            <span class="tadaza-item-title">⚡ 1. Chuyển đổi 1-Click (Quick Switch)</span>
            <div class="tadaza-item-desc">Hoán đổi phiên làm việc và khởi động lại vào tài khoản mới chỉ trong 1-2 giây, dữ liệu tin nhắn tách biệt tuyệt đối an toàn.</div>
          </div>
          <div class="tadaza-item tadaza-item-col" style="margin-top: 8px;">
            <span class="tadaza-item-title">🚀 2. Mở song song (Dual Windows)</span>
            <div class="tadaza-item-desc">Mở đồng thời 2 hoặc nhiều cửa sổ Zalo cạnh nhau trên màn hình để vừa chat cá nhân vừa trả lời khách hàng cùng lúc!</div>
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
