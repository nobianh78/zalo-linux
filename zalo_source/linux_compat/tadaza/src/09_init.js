/* --------------------------------------------------------------------------
     7. Initialization & Bridge Listeners
     -------------------------------------------------------------------------- */
  function setupUpdateBannerListener() {
    if (!window.electronAPI || !window.electronAPI.on) return;
    window.electronAPI.on('tadaza:update-available', (event, data) => {
      if (!data || !data.version) return;
      if (document.getElementById('tadaza-inapp-update-banner')) return;

      const banner = document.createElement('div');
      banner.id = 'tadaza-inapp-update-banner';
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 40px;
        background: linear-gradient(135deg, #0068ff 0%, #00a4ff 100%);
        color: #ffffff;
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        box-shadow: 0 4px 14px rgba(0, 104, 255, 0.4);
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">🚀</span>
          <span><strong>Đã có bản cập nhật mới v${data.version}!</strong> (Bản hiện tại: v${data.currentVersion})</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button id="btn-banner-update-now" style="background:#ffffff; color:#0068ff; border:none; border-radius:6px; font-weight:700; padding:6px 14px; cursor:pointer; font-size:12px; box-shadow:0 2px 4px rgba(0,0,0,0.15);">Cập nhật ngay</button>
          <button id="btn-banner-update-close" style="background:transparent; color:#ffffff; border:none; font-size:16px; cursor:pointer; padding:4px; opacity:0.8;">✕</button>
        </div>
      `;

      document.body.prepend(banner);

      const closeBtn = banner.querySelector('#btn-banner-update-close');
      if (closeBtn) closeBtn.onclick = () => banner.remove();

      const updateBtn = banner.querySelector('#btn-banner-update-now');
      if (updateBtn) {
        updateBtn.onclick = async () => {
          updateBtn.disabled = true;
          updateBtn.textContent = 'Đang xử lý...';
          try {
            await window.electronAPI.invoke('tadaza:perform-update', {
              assetUrl: data.assetUrl,
              version: data.version
            });
          } catch (e) {
            alert('Lỗi cập nhật: ' + e.message);
            updateBtn.disabled = false;
            updateBtn.textContent = 'Cập nhật ngay';
          }
        };
      }
    });
  }

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

    // Listen for update available notifications
    setupUpdateBannerListener();

    // Mount UI when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        buildUI();
        setupMessageTranslator();
        setupMessageCodeFormatter();
        setupInputMarkdownShortcuts();
        setupQuickParser();
        setupMultiAccountSwitcher();
      });
    } else {
      buildUI();
      setupMessageTranslator();
      setupMessageCodeFormatter();
      setupInputMarkdownShortcuts();
      setupQuickParser();
      setupMultiAccountSwitcher();
    }
  }

  init();
