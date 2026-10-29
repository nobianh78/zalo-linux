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
})();
