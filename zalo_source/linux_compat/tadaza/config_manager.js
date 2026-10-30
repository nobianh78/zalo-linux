const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'ZaloData');
const CONFIG_FILE = path.join(CONFIG_DIR, 'tadaza_config.json');

const DEFAULT_CONFIG = {
  theme: {
    mode: 'light', // 'light' | 'dark' | 'system'
    deep_dark: false,
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
  floating_chat: {
    enabled: true,
    always_on_top: true,
    auto_collapse_blur: false,
    bubble_size: 64,
    window_width: 370,
    window_height: 520,
    pinned_chats: []
  },
  system: {
    close_to_tray: false
  }
};

class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.ensureDir();
    this.load();
  }

  ensureDir() {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
    } catch (e) {
      console.error('[TADaZa Config] Failed to create config dir:', e.message);
    }
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.config = {
          theme: { ...DEFAULT_CONFIG.theme, ...(parsed.theme || {}) },
          privacy: { ...DEFAULT_CONFIG.privacy, ...(parsed.privacy || {}) },
          translate: { ...DEFAULT_CONFIG.translate, ...(parsed.translate || {}) },
          markdown: { ...DEFAULT_CONFIG.markdown, ...(parsed.markdown || {}) },
          quick_parser: { ...DEFAULT_CONFIG.quick_parser, ...(parsed.quick_parser || {}) },
          floating_chat: { ...DEFAULT_CONFIG.floating_chat, ...(parsed.floating_chat || {}) }
        };
      } else {
        this.save();
      }
    } catch (e) {
      console.warn('[TADaZa Config] Failed to read config, using defaults:', e.message);
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }

  save(newConfig = null) {
    if (newConfig) {
      this.config = {
        theme: { ...this.config.theme, ...(newConfig.theme || {}) },
        privacy: { ...this.config.privacy, ...(newConfig.privacy || {}) },
        translate: { ...this.config.translate, ...(newConfig.translate || {}) },
        markdown: { ...this.config.markdown, ...(newConfig.markdown || {}) },
        quick_parser: { ...this.config.quick_parser, ...(newConfig.quick_parser || {}) },
        floating_chat: { ...this.config.floating_chat, ...(newConfig.floating_chat || {}) }
      };
    }
    try {
      this.ensureDir();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (e) {
      console.error('[TADaZa Config] Failed to save config:', e.message);
    }
    return this.config;
  }

  get() {
    return this.config;
  }
}

let instance = null;
function getConfigManager() {
  if (!instance) {
    instance = new ConfigManager();
  }
  return instance;
}

module.exports = {
  getConfigManager,
  DEFAULT_CONFIG,
  CONFIG_FILE
};
