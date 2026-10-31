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
    wallpaper_blur: 0,
    hawaiian_theme: false,
    hawaiian_opacity: 0.85,
    hawaiian_fps: 15,
    active_preset: 'none', // fresh installs start with stock Zalo; users pick a scene in TADaZa
    theme_opacity: 0.85,
    theme_fps: 20
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
    close_to_tray: false,
    display_mode: 'x11',  // 'x11' (XWayland, Vietnamese IME works everywhere) | 'wayland' (native, opt-in)
    scale_factor: 0,      // 0 = automatic, otherwise e.g. 1.25 / 1.5 / 2
    unread_badge: true,   // unread count on dock (LauncherEntry) and tray icon
    extra_reactions: true // 18 reactions in the picker instead of Zalo's 6
  }
};

// Merge every top-level section (theme, privacy, ..., system) so new sections are never dropped.
function mergeSections(base, patch) {
  const out = {};
  const keys = new Set([...Object.keys(DEFAULT_CONFIG), ...Object.keys(base || {})]);
  for (const key of keys) {
    out[key] = { ...(DEFAULT_CONFIG[key] || {}), ...((base || {})[key] || {}), ...((patch || {})[key] || {}) };
  }
  return out;
}

class ConfigManager {
  constructor() {
    this.config = mergeSections(DEFAULT_CONFIG, null);
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
        this.config = mergeSections(DEFAULT_CONFIG, parsed);
      } else {
        this.save();
      }
    } catch (e) {
      console.warn('[TADaZa Config] Failed to read config, using defaults:', e.message);
      this.config = mergeSections(DEFAULT_CONFIG, null);
    }
    return this.config;
  }

  save(newConfig = null) {
    if (newConfig) {
      this.config = mergeSections(this.config, newConfig);
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

function getConfig() {
  return getConfigManager().get();
}

module.exports = {
  getConfigManager,
  getConfig,
  DEFAULT_CONFIG,
  CONFIG_FILE
};
