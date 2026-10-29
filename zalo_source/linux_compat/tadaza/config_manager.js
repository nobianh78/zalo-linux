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
          translate: { ...DEFAULT_CONFIG.translate, ...(parsed.translate || {}) }
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
        translate: { ...this.config.translate, ...(newConfig.translate || {}) }
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
