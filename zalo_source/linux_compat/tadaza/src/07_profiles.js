/* --------------------------------------------------------------------------
     7. Multi-Account Switcher (Profiles System)
     -------------------------------------------------------------------------- */
  let activeProfilesData = {
    currentProfileId: 'default',
    activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Tài khoản Chính (Cá nhân)', avatar: '', userDataDir: 'ZaloData', createdAt: Date.now() }
    ]
  };

  function ensureProfilesModal() {
    let overlay = document.getElementById('tadaza-profiles-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tadaza-profiles-overlay';
      overlay.className = 'tadaza-profiles-modal-overlay';
      overlay.innerHTML = `
        <div class="tadaza-profiles-modal">
          <div class="tadaza-profiles-header">
            <div class="tadaza-profiles-title-wrap">
              <div class="tadaza-profiles-icon-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div>
                <div class="tadaza-profiles-title">Quản lý Đa tài khoản</div>
                <div class="tadaza-profiles-subtitle">Lưu trữ phiên đăng nhập độc lập • Chuyển đổi nhanh 1-click hoặc mở song song</div>
              </div>
            </div>
            <button class="tadaza-profiles-close-btn" id="tadaza-btn-close-profiles" title="Đóng (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="tadaza-profiles-body" id="tadaza-profiles-list">
            <!-- Dynamic profiles list -->
          </div>
          <div class="tadaza-profiles-footer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>💡 <b>Mẹo:</b> Bạn có thể bấm <b>"Mở song song"</b> để chạy đồng thời nhiều tài khoản Zalo trên cùng một màn hình máy tính!</span>
          </div>
        </div>
      `;
      (document.body || document.documentElement).appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeProfilesModal();
        }
      });

      const closeBtn = overlay.querySelector('#tadaza-btn-close-profiles');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          closeProfilesModal();
        });
      }
    } else if (!overlay.parentElement) {
      (document.body || document.documentElement).appendChild(overlay);
    }
    return overlay;
  }

  async function openProfilesModal() {
    console.log('[TADaZa] Opening Multi-Account Profiles Modal...');
    const overlay = ensureProfilesModal();

    try {
      if (bridge && typeof bridge.getProfiles === 'function') {
        const data = await bridge.getProfiles();
        if (data && Array.isArray(data.profiles) && data.profiles.length > 0) {
          activeProfilesData = data;
        }
      }
    } catch (e) {
      console.warn('[Multi-Profile] Error getting profiles:', e);
    }

    try {
      renderProfilesList();
    } catch (err) {
      console.error('[Multi-Profile] Error in renderProfilesList:', err);
    }

    overlay.classList.add('active');
    const profNavBtn = document.getElementById('nav-item-tadaza-profiles');
    if (profNavBtn) profNavBtn.classList.add('active');
  }

  function closeProfilesModal() {
    const overlay = document.getElementById('tadaza-profiles-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    const profNavBtn = document.getElementById('nav-item-tadaza-profiles');
    if (profNavBtn) profNavBtn.classList.remove('active');
  }

  window.tadazaOpenProfiles = openProfilesModal;
  window.openProfilesModal = openProfilesModal;
  window.openProfilesModalGlobal = openProfilesModal;

  function renderProfilesList() {
    const listContainer = document.getElementById('tadaza-profiles-list');
    if (!listContainer) return;

    const currentId = activeProfilesData.currentProfileId || 'default';
    const profiles = activeProfilesData.profiles || [];

    let html = '';

    profiles.forEach(p => {
      const isCurrent = (p.id === currentId);
      const initial = (p.name || 'Z').trim().charAt(0).toUpperCase();

      html += `
        <div class="tadaza-profile-card ${isCurrent ? 'active' : ''}">
          <div class="tadaza-profile-info">
            <div class="tadaza-profile-avatar-wrap">
              ${p.avatar
                ? `<img class="tadaza-profile-avatar" src="${escapeHtml(p.avatar)}" alt="${escapeHtml(p.name)}">`
                : `<div class="tadaza-profile-avatar-fallback">${initial}</div>`
              }
              ${isCurrent ? '<span class="tadaza-avatar-status-dot" title="Tài khoản đang hoạt động"></span>' : ''}
            </div>
            <div class="tadaza-profile-details">
              <div class="tadaza-profile-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
              <div class="tadaza-profile-sub">
                ${isCurrent ? '🟢 Cửa sổ hiện tại đang chạy' : 'Phiên làm việc độc lập • Sẵn sàng chuyển đổi'}
              </div>
            </div>
          </div>
          <div class="tadaza-profile-actions">
            ${isCurrent
              ? '<span class="tadaza-badge-current"><span class="tadaza-pulse-dot"></span> Đang chạy</span>'
              : `
                <button class="tadaza-btn-action tadaza-btn-switch" data-switch-id="${escapeHtml(p.id)}" title="Chuyển sang tài khoản này (Khởi động lại app)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  <span>Chuyển sang</span>
                </button>
                <button class="tadaza-btn-action tadaza-btn-dual" data-dual-id="${escapeHtml(p.id)}" title="Mở thêm cửa sổ Zalo thứ 2 chạy song song">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  <span>Mở song song</span>
                </button>
              `
            }
            <button class="tadaza-btn-icon-only" data-rename-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" title="Đổi tên gợi nhớ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            ${(!isCurrent && p.id !== 'default')
              ? `
                <button class="tadaza-btn-icon-only danger" data-delete-id="${escapeHtml(p.id)}" title="Xóa tài khoản này">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              `
              : ''
            }
          </div>
        </div>
      `;
    });

    html += `
      <div class="tadaza-add-profile-wrap">
        <button class="tadaza-btn-add-profile" id="tadaza-btn-toggle-add-profile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Thêm tài khoản mới...</span>
        </button>

        <div class="tadaza-new-profile-form" id="tadaza-new-profile-form">
          <input type="text" class="tadaza-new-profile-input" id="tadaza-input-new-profile-name" placeholder="Nhập tên tài khoản (VD: Bán hàng, Shop online, Công việc)..." maxlength="40">
          <div class="tadaza-new-profile-form-actions">
            <button class="tadaza-btn-action" id="tadaza-btn-cancel-new-profile" style="background: transparent; color: #64748b;">Hủy</button>
            <button class="tadaza-btn-action tadaza-btn-switch" id="tadaza-btn-submit-new-profile">Tạo tài khoản</button>
          </div>
        </div>
      </div>
    `;

    listContainer.innerHTML = html;

    // Event bindings
    listContainer.querySelectorAll('[data-switch-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-switch-id');
        btn.innerHTML = '<span>Đang chuyển...</span>';
        btn.disabled = true;
        await bridge.switchProfile(id);
      });
    });

    listContainer.querySelectorAll('[data-dual-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-dual-id');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<span>Đang mở...</span>';
        btn.disabled = true;
        await bridge.launchDualProfile(id);
        setTimeout(() => {
          btn.innerHTML = oldText;
          btn.disabled = false;
          closeProfilesModal();
        }, 1200);
      });
    });

    listContainer.querySelectorAll('[data-rename-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-rename-id');
        const oldName = btn.getAttribute('data-name') || '';
        const newName = prompt('Nhập tên mới cho tài khoản này:', oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
          await bridge.renameProfile(id, newName.trim());
          await openProfilesModal();
          updateTriggerButton();
        }
      });
    });

    listContainer.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-delete-id');
        if (confirm('Bạn có chắc chắn muốn xóa tài khoản này khỏi danh sách? (Dữ liệu phiên sẽ được dọn dẹp)')) {
          await bridge.deleteProfile(id, true);
          await openProfilesModal();
          updateTriggerButton();
        }
      });
    });

    const toggleAddBtn = listContainer.querySelector('#tadaza-btn-toggle-add-profile');
    const addForm = listContainer.querySelector('#tadaza-new-profile-form');
    const inputName = listContainer.querySelector('#tadaza-input-new-profile-name');
    const cancelAddBtn = listContainer.querySelector('#tadaza-btn-cancel-new-profile');
    const submitAddBtn = listContainer.querySelector('#tadaza-btn-submit-new-profile');

    if (toggleAddBtn && addForm) {
      toggleAddBtn.addEventListener('click', () => {
        toggleAddBtn.style.display = 'none';
        addForm.classList.add('active');
        if (inputName) inputName.focus();
      });

      if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', () => {
          addForm.classList.remove('active');
          toggleAddBtn.style.display = 'flex';
        });
      }

      const handleCreate = async () => {
        const nameVal = inputName ? inputName.value.trim() : '';
        submitAddBtn.textContent = 'Đang tạo...';
        submitAddBtn.disabled = true;
        const newProf = await bridge.addProfile(nameVal || 'Tài khoản mới');
        if (newProf && newProf.id) {
          await openProfilesModal();
          updateTriggerButton();
          if (confirm(`Đã tạo "${newProf.name}"!\nBạn có muốn mở ngay một cửa sổ Zalo thứ 2 để đăng nhập tài khoản này không?`)) {
            await bridge.launchDualProfile(newProf.id);
            closeProfilesModal();
          }
        }
      };

      if (submitAddBtn) submitAddBtn.addEventListener('click', handleCreate);
      if (inputName) {
        inputName.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') handleCreate();
        });
      }
    }
  }

  function updateTriggerButton() {
    const curId = activeProfilesData.currentProfileId || 'default';
    const cur = (activeProfilesData.profiles || []).find(p => p.id === curId);
    const name = cur ? cur.name : 'Tài khoản Chính';

    const triggerBtn = document.getElementById('tadaza-btn-profiles');
    if (triggerBtn) {
      const label = triggerBtn.querySelector('.profile-name-text');
      if (label) label.textContent = name;
    }

    const profNavBtn = document.getElementById('nav-item-tadaza-profiles');
    if (profNavBtn) {
      profNavBtn.title = `Quản lý Đa tài khoản [${name}] (Chuyển đổi 1-click & Mở song song) [Ctrl+Shift+P]`;
    }
  }

  function setupMultiAccountSwitcher() {
    // 1. Ensure Modal DOM is mounted
    ensureProfilesModal();

    // 2. Global keyboard shortcut: Ctrl+Shift+P or Alt+P to toggle multi-account modal
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) ||
          (e.altKey && (e.key === 'P' || e.key === 'p'))) {
        e.preventDefault();
        const overlay = document.getElementById('tadaza-profiles-overlay');
        if (overlay && overlay.classList.contains('active')) {
          closeProfilesModal();
        } else {
          openProfilesModal();
        }
      } else if (e.key === 'Escape') {
        const overlay = document.getElementById('tadaza-profiles-overlay');
        if (overlay && overlay.classList.contains('active')) {
          closeProfilesModal();
        }
      }
    });

    // 3. Insert trigger button into DOM
    const insertTriggerButton = () => {
      if (document.getElementById('tadaza-btn-profiles')) return;

      const btn = document.createElement('div');
      btn.id = 'tadaza-btn-profiles';
      btn.className = 'tadaza-profiles-trigger-btn';
      btn.title = 'Quản lý Đa tài khoản (Chuyển đổi 1-click & Mở song song) [Ctrl+Shift+P]';
      btn.innerHTML = `
        <span class="profile-dot"></span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span class="profile-name-text">Tài khoản</span>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfilesModal();
      });

      // Target placement: top search area or left sidebar top
      const searchBox = document.querySelector('#search-contact-input, .search-box, [class*="search-box"]');
      if (searchBox && searchBox.parentElement) {
        searchBox.parentElement.insertBefore(btn, searchBox);
      } else {
        const header = document.querySelector('.main-title-container, .header-info, [class*="header-title"]');
        if (header && header.parentElement) {
          header.parentElement.appendChild(btn);
        }
      }

      updateTriggerButton();
    };

    const syncProfileMeta = () => {
      try {
        const curId = activeProfilesData.currentProfileId || 'default';
        const cur = (activeProfilesData.profiles || []).find(p => p.id === curId);
        if (!cur) return;

        const navImg = document.querySelector('.nav__tabs__bottom img, .nav__tabs__top img, .nav__avatar img');
        if (navImg && navImg.src && !navImg.src.includes('data:image/svg')) {
          if (!cur.avatar || cur.avatar !== navImg.src) {
            cur.avatar = navImg.src;
            bridge.updateProfileInfo({ profileId: curId, avatar: navImg.src });
          }
        }
      } catch (e) {}
    };

    bridge.getProfiles().then(data => {
      if (data && Array.isArray(data.profiles) && data.profiles.length > 0) {
        activeProfilesData = data;
        updateTriggerButton();
      }
    }).catch(() => {});

    insertTriggerButton();
    setInterval(syncProfileMeta, 5000);

    const profObs = new MutationObserver(() => {
      if (!document.getElementById('tadaza-btn-profiles')) {
        insertTriggerButton();
      }
    });
    profObs.observe(document.body, { childList: true, subtree: true });
  }
