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
      } catch (e) { }
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
    getProfiles: async () => ({ currentProfileId: 'default', activeProfile: 'default', profiles: [] }),
    addProfile: async (name) => ({ success: false }),
    renameProfile: async (id, newName) => ({ success: false }),
    updateProfileInfo: async (info) => ({ success: false }),
    deleteProfile: async (id, deleteFiles) => ({ success: false }),
    switchProfile: async (id) => ({ success: false }),
    launchDualProfile: async (id) => ({ success: false }),
    onConfigChanged: () => { }
  };

  let currentConfig = {
    theme: {
      mode: 'system',
      deep_dark: true,
      font_family: 'Default',
      font_size: 14,
      wallpaper: '',
      wallpaper_opacity: 0.85,
      wallpaper_blur: 0,
      hawaiian_theme: false,
      hawaiian_opacity: 0.85,
      hawaiian_fps: 15
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
    system: {
      close_to_tray: false,
      display_mode: 'x11',
      scale_factor: 0,
      unread_badge: true,
      extra_reactions: true
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
