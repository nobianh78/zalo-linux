/* Auto-generated bundle from linux_compat/tadaza/src - Do not edit directly */

(function () {
  'use strict';

/* ==========================================================================
   MODULE: 00_shared.js
   ========================================================================== */

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
      unread_badge: true
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

/* ==========================================================================
   MODULE: 01_privacy_network.js
   ========================================================================== */

/* --------------------------------------------------------------------------
     1. Network Hooks for Privacy (Typing, Seen, Delivered)
     -------------------------------------------------------------------------- */
  function setupNetworkHooks() {
    if (window.__TADAZA_NETWORK_HOOKED__) return;
    window.__TADAZA_NETWORK_HOOKED__ = true;

    function checkUrlBlock(url) {
      if (!url || typeof url !== 'string') return null;
      if (currentConfig.privacy && currentConfig.privacy.hide_typing && /\/api\/(message|group)\/typing(?:\?|\/|#|$)/i.test(url)) {
        return 'typing';
      }
      if (currentConfig.privacy && currentConfig.privacy.hide_seen && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:seen|seenv2|react_seen)(?:\?|\/|#|$)/i.test(url)) {
        return 'seen';
      }
      if (currentConfig.privacy && currentConfig.privacy.hide_delivered && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:delivered|deliveredv2|react_delivered)(?:\?|\/|#|$)/i.test(url)) {
        return 'delivered';
      }
      return null;
    }

    // 1. Intercept XMLHttpRequest (Zalo uses Axios / Toxo wrapping XMLHttpRequest)
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        this._tadazaUrl = (url && typeof url.toString === 'function') ? url.toString() : String(url || '');
        this._tadazaMethod = method;
      } catch (e) { }
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const blockedReason = checkUrlBlock(this._tadazaUrl);
      if (blockedReason) {
        console.log(`[TADaZa Privacy] Blocked XHR (${blockedReason}):`, this._tadazaUrl);

        const mockPayload = JSON.stringify({
          error_code: 0,
          data: { ok: true },
          message: 'Success'
        });

        try {
          Object.defineProperty(this, 'readyState', { value: 4, writable: true, configurable: true });
          Object.defineProperty(this, 'status', { value: 200, writable: true, configurable: true });
          Object.defineProperty(this, 'statusText', { value: 'OK', writable: true, configurable: true });
          Object.defineProperty(this, 'responseText', { value: mockPayload, writable: true, configurable: true });
          Object.defineProperty(this, 'response', { value: mockPayload, writable: true, configurable: true });
          Object.defineProperty(this, 'responseURL', { value: this._tadazaUrl, writable: true, configurable: true });
        } catch (e) {
          this.readyState = 4;
          this.status = 200;
          this.statusText = 'OK';
          this.responseText = mockPayload;
          this.response = mockPayload;
        }

        this.getAllResponseHeaders = function () {
          return 'content-type: application/json; charset=utf-8\r\n';
        };
        this.getResponseHeader = function (header) {
          if (header && header.toLowerCase() === 'content-type') {
            return 'application/json; charset=utf-8';
          }
          return null;
        };

        setTimeout(() => {
          try {
            const readyEvt = new Event('readystatechange');
            if (typeof this.onreadystatechange === 'function') {
              this.onreadystatechange(readyEvt);
            }
            this.dispatchEvent(readyEvt);
          } catch (e) { }

          try {
            const loadEvt = new ProgressEvent('load');
            if (typeof this.onload === 'function') {
              this.onload(loadEvt);
            }
            this.dispatchEvent(loadEvt);
          } catch (e) { }

          try {
            const loadEndEvt = new ProgressEvent('loadend');
            if (typeof this.onloadend === 'function') {
              this.onloadend(loadEndEvt);
            }
            this.dispatchEvent(loadEndEvt);
          } catch (e) { }
        }, 10);

        return;
      }

      return origSend.apply(this, arguments);
    };

    // 2. Intercept window.fetch
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input && typeof input.url === 'string') {
        url = input.url;
      }
      const blockedReason = checkUrlBlock(url);
      if (blockedReason) {
        console.log(`[TADaZa Privacy] Blocked Fetch (${blockedReason}):`, url);
        return Promise.resolve(new Response(JSON.stringify({ error_code: 0, data: { ok: true } }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return origFetch.apply(this, arguments);
    };
  }

/* ==========================================================================
   MODULE: 02_hawaiian_theme.js
   ========================================================================== */

/* --------------------------------------------------------------------------
   2b. Hawaiian Lagoon Live Animated ASCII Theme
   -------------------------------------------------------------------------- */

let hawaiianAnimId = null;
let hawaiianEngineRunning = false;
let hawaiianContainer = null;
let hawaiianCanvas = null;
let hawaiianCtx = null;
let hawaiianLastTime = 0;
let hawaiianT0 = 0;
let hawaiianStaticBuilt = false;
let hawaiianTargetFps = 30;
let hawaiianFpsInterval = 1000 / 30;

// Geometry and rendering buffers
const HW_W = 1944, HW_H = 1760, HW_T = 24.5, HW_TAU = Math.PI * 2, HW_w = HW_TAU / HW_T;
const HW_CW = 16, HW_CH = 22, HW_COLS = Math.ceil(HW_W / HW_CW), HW_ROWS = Math.ceil(HW_H / HW_CH);

let hw_oc, hw_ox, hw_bgc, hw_bgx, hw_reefc, hw_reefx;
const hwBuf = new Float32Array(HW_COLS * HW_ROWS * 4);
let hwBBox = { minI: 0, maxI: HW_COLS - 1, minJ: 0, maxJ: HW_ROWS - 1 };

const hwHash = (a, b, c) => {
  let h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return h - Math.floor(h);
};

const hwMix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const hwRgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hwLum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

const HW_STOPS = [[0, [178, 244, 232]], [0.42, [74, 214, 214]], [0.78, [26, 168, 202]], [1, [14, 128, 182]]];
const hwWater = (x, y) => {
  const k = Math.min(1, Math.max(0, (x * 0.45 + y * 0.9) / (HW_W * 0.45 + HW_H * 0.9)));
  for (let i = 1; i < HW_STOPS.length; i++) {
    if (k <= HW_STOPS[i][0]) {
      return hwMix(HW_STOPS[i - 1][1], HW_STOPS[i][1], (k - HW_STOPS[i - 1][0]) / (HW_STOPS[i][0] - HW_STOPS[i - 1][0]));
    }
  }
  return HW_STOPS[3][1];
};

const hwEll = (g, x, y, rx, ry, rot, fill) => {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot || 0, 0, HW_TAU);
  g.fillStyle = fill;
  g.fill();
};

function hwTurtle(g, t, s, ph) {
  const f = Math.sin(HW_TAU * 14 * t / HW_T + ph);
  for (const m of [-1, 1]) {
    g.save(); g.translate(62, 58 * m); g.rotate(m * (1.15 + 0.55 * f));
    hwEll(g, 0, 78 * m, 26, 92, 0, "#9c8a5c"); hwEll(g, 0, 70 * m, 14, 70, 0, "#c2b183"); g.restore();
    g.save(); g.translate(-92, 40 * m); g.rotate(m * (2.2 - 0.3 * f));
    hwEll(g, 0, 26 * m, 15, 34, 0, "#9c8a5c"); g.restore();
  }
  hwEll(g, 118, 0, 30, 24, 0, "#a39060"); hwEll(g, 150, 0, 34, 27, 0, "#b8a573");
  hwEll(g, 146, -10, 7, 5, 0, "#4b3f22"); hwEll(g, 146, 10, 7, 5, 0, "#4b3f22");
  hwEll(g, 0, 0, 132, 100, 0, "#c9b067");
  const sh = g.createRadialGradient(-10, 0, 10, 0, 0, 125);
  sh.addColorStop(0, "#7d6a2e"); sh.addColorStop(0.7, "#5e5022"); sh.addColorStop(1, "#3f3616");
  hwEll(g, 0, 0, 120, 90, 0, sh);
  g.fillStyle = "#b39a4a";
  for (const [x, y, r] of [[60, 0, 26], [12, 0, 30], [-38, 0, 28], [-80, 0, 20], [40, -50, 22], [-8, -56, 24], [-56, -46, 20], [40, 50, 22], [-8, 56, 24], [-56, 46, 20]]) {
    g.beginPath(); for (let k = 0; k < 6; k++) g.lineTo(x + r * Math.cos(k * HW_TAU / 6), y + r * 0.8 * Math.sin(k * HW_TAU / 6)); g.fill();
  }
  g.fillStyle = "#e0c56a";
  for (const [x, y] of [[60, 0], [12, 0], [-38, 0], [-8, -56], [-8, 56]]) { g.beginPath(); g.arc(x, y, 8, 0, HW_TAU); g.fill(); }
}

function hwManta(g, t) {
  const f = Math.sin(HW_TAU * 10 * t / HW_T), span = 300 + 22 * f, back = -40 - 30 * f;
  g.beginPath(); g.moveTo(-110, 0); g.lineTo(-330, 4 * f); g.lineWidth = 7; g.strokeStyle = "#1c2733"; g.stroke();
  g.beginPath(); g.moveTo(96, -42);
  g.quadraticCurveTo(40, -span * 0.75, back, -span); g.quadraticCurveTo(-60, -110, -118, -26);
  g.lineTo(-118, 26); g.quadraticCurveTo(-60, 110, back, span); g.quadraticCurveTo(40, span * 0.75, 96, 42);
  g.closePath(); g.fillStyle = "#1e2b3a"; g.fill();
  for (const m of [-1, 1]) {
    hwEll(g, 120, 40 * m, 34, 12, 0.35 * m, "#26364a");
    hwEll(g, 18, 82 * m, 70, 30, -0.5 * m, "#e9eef0");
    hwEll(g, -10, 150 * m, 40, 18, -0.6 * m, "#8fa3b0");
  }
}

function hwDolphin(g, t, ph) {
  const b = 0.22 * Math.sin(HW_TAU * 60 * t / HW_T + ph);
  g.save(); g.translate(-30, 0); g.rotate(b);
  g.beginPath(); g.moveTo(10, -44); g.quadraticCurveTo(-90, -24, -150, -9); g.lineTo(-150, 9); g.quadraticCurveTo(-90, 24, 10, 44); g.fillStyle = "#5c6d7c"; g.fill();
  g.translate(-150, 0); g.rotate(b * 1.4);
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-20, -60, -52, -66); g.quadraticCurveTo(-30, -20, -40, 0); g.quadraticCurveTo(-30, 20, -52, 66); g.quadraticCurveTo(-20, 60, 0, 0); g.fillStyle = "#4b5a68"; g.fill();
  g.restore();
  for (const m of [-1, 1]) hwEll(g, 40, 48 * m, 44, 13, -0.75 * m, "#6f8190");
  g.beginPath(); g.moveTo(-40, -44); g.quadraticCurveTo(40, -58, 150, -18); g.lineTo(200, -4); g.lineTo(200, 4); g.lineTo(150, 18); g.quadraticCurveTo(40, 58, -40, 44); g.fillStyle = "#8a9cab"; g.fill();
  hwEll(g, 20, 0, 120, 22, 0, "#43515e");
}

function hwTang(g, t, ph) {
  const b = 0.35 * Math.sin(HW_TAU * 110 * t / HW_T + ph);
  g.save(); g.translate(-30, 0); g.rotate(b);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-34, -20); g.lineTo(-28, 0); g.lineTo(-34, 20); g.closePath(); g.fillStyle = "#f2c200"; g.fill(); g.restore();
  hwEll(g, 8, 0, 46, 15, 0, "#ffd61f"); hwEll(g, 40, 0, 12, 9, 0, "#ffe46a");
}

function hwWhale(g, t) {
  const b = 0.16 * Math.sin(HW_TAU * 8 * t / HW_T);
  g.save(); g.translate(-260, 0); g.rotate(b);
  g.beginPath(); g.moveTo(40, -70); g.quadraticCurveTo(-120, -30, -260, -14); g.lineTo(-260, 14); g.quadraticCurveTo(-120, 30, 40, 70); g.fillStyle = "#2b3d52"; g.fill();
  g.translate(-260, 0); g.rotate(b * 1.5);
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-30, -110, -90, -130); g.quadraticCurveTo(-60, -40, -70, 0); g.quadraticCurveTo(-60, 40, -90, 130); g.quadraticCurveTo(-30, 110, 0, 0); g.fillStyle = "#dfe7ea"; g.fill();
  g.restore();
  const fl = 0.15 * Math.sin(HW_TAU * 8 * t / HW_T + 1);
  for (const m of [-1, 1]) {
    g.save(); g.translate(150, 95 * m); g.rotate(m > 0 ? 0.6 + fl : Math.PI - 0.6 - fl); hwEll(g, 0, 120, 30, 125, 0, "#e6eef0"); g.restore();
  }
  g.beginPath(); g.moveTo(330, 0); g.quadraticCurveTo(300, -110, 100, -130); g.quadraticCurveTo(-120, -110, -260, -70); g.lineTo(-260, 70); g.quadraticCurveTo(-120, 110, 100, 130); g.quadraticCurveTo(300, 110, 330, 0); g.fillStyle = "#33475e"; g.fill();
  g.fillStyle = "#596f86"; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(300 - k * 30, 0, 7, 0, HW_TAU); g.fill(); }
  g.beginPath(); g.moveTo(-60, -10); g.quadraticCurveTo(-90, 0, -60, 10); g.fillStyle = "#1e2d3e"; g.fill();
}

function hwHibiscus(g, s) {
  for (let k = 0; k < 5; k++) { g.save(); g.rotate(k * HW_TAU / 5); hwEll(g, 52 * s, 0, 52 * s, 40 * s, 0, "#ef3b5a"); hwEll(g, 40 * s, 0, 30 * s, 22 * s, 0, "#d42448"); g.restore(); }
  hwEll(g, 0, 0, 22 * s, 22 * s, 0, "#8a0f2e");
  g.save(); g.rotate(0.6); hwEll(g, 44 * s, 0, 40 * s, 5 * s, 0, "#ffd84a"); hwEll(g, 84 * s, 0, 10 * s, 10 * s, 0, "#ffe27a"); g.restore();
}

function hwPlumeria(g, s) {
  for (let k = 0; k < 5; k++) { g.save(); g.rotate(k * HW_TAU / 5); hwEll(g, 36 * s, 12 * s, 40 * s, 24 * s, 0.35, "#fffaf0"); g.restore(); }
  const c = g.createRadialGradient(0, 0, 2, 0, 0, 34 * s); c.addColorStop(0, "#ffb800"); c.addColorStop(1, "rgba(255,214,90,0)");
  hwEll(g, 0, 0, 34 * s, 34 * s, 0, c);
}

const HW_P = {
  turtleA: (t) => [972 + 1080 * Math.cos(HW_w * t + 0.3), 860 + 640 * Math.sin(HW_w * t + 0.3) + 140 * Math.sin(2 * HW_w * t)],
  turtleB: (t) => [900 + 700 * Math.sin(-HW_w * t + 1), 880 - 1080 * Math.cos(-HW_w * t + 1)],
  turtleC: (t) => [972 + 1150 * Math.sin(HW_w * t + 4), 900 + 560 * Math.sin(2 * HW_w * t + 4.6)],
  manta: (t) => [972 + 1380 * Math.cos(-HW_w * t + 3.6), 820 + 900 * Math.sin(-HW_w * t + 3.6)],
  dolphin: (t) => [972 + 1350 * Math.cos(2 * HW_w * t + 0.8), 900 + 950 * Math.sin(2 * HW_w * t + 0.8) + 160 * Math.sin(4 * HW_w * t)],
  school: (t) => [972 + 1150 * Math.sin(2 * HW_w * t + 5), 880 + 800 * Math.sin(3 * HW_w * t + 1)],
  whale: (t) => [972 + 1900 * Math.cos(HW_w * t + 2.4), 1350 + 380 * Math.sin(HW_w * t + 2.4)],
};

const hwPose = (fn, t) => { const [x, y] = fn(t), [x2, y2] = fn(t + 0.02); return [x, y, Math.atan2(y2 - y, x2 - x)]; };
const HW_FISH = [[0, 0], [-120, -70], [-120, 75], [-240, -10], [-230, -140], [-235, 130], [-360, -75], [-355, 70], [-470, 5], [-480, -150], [-470, 150]];
const HW_FLOWERS = [["h", 0.0, 380, 1.0, 1], ["p", 0.22, 1240, 0.9, -1], ["h", 0.47, 640, 0.8, -1], ["p", 0.63, 1560, 1.1, 1], ["p", 0.86, 340, 0.8, 1]];

function hwSample(draw) {
  hw_ox.setTransform(1, 0, 0, 1, 0, 0);
  hw_ox.clearRect(0, 0, HW_COLS, HW_ROWS);
  hw_ox.setTransform(HW_COLS / HW_W, 0, 0, HW_ROWS / HW_H, 0, 0);
  draw(hw_ox);
  const d = hw_ox.getImageData(0, 0, HW_COLS, HW_ROWS).data;
  let minI = HW_COLS, maxI = -1, minJ = HW_ROWS, maxJ = -1;
  for (let j = 0; j < HW_ROWS; j++) {
    for (let i = 0; i < HW_COLS; i++) {
      const p = (j * HW_COLS + i) * 4;
      const al = d[p + 3];
      if (al > 10) {
        hwBuf[p] = d[p];
        hwBuf[p + 1] = d[p + 1];
        hwBuf[p + 2] = d[p + 2];
        hwBuf[p + 3] = al / 255;
        if (i < minI) minI = i;
        if (i > maxI) maxI = i;
        if (j < minJ) minJ = j;
        if (j > maxJ) maxJ = j;
      } else {
        hwBuf[p + 3] = 0;
      }
    }
  }
  hwBBox = maxI >= minI ? { minI, maxI, minJ, maxJ } : { minI: 0, maxI: 0, minJ: 0, maxJ: 0 };
  return hwBuf;
}

const hwPut = (g, fn, t, x, y, a, s, draw) => { g.save(); g.translate(x, y); g.rotate(a); if (s !== 1) g.scale(s, s); draw(g); g.restore(); };

const HW_RAMP = "8%XSSt%t;:";
const HW_EDGE = "',.o:;";
const HW_SPRINK = ["#ff5fa2", "#16c79a", "#8b6cff", "#ffb000"];

function hwCells(L, depth, t, glyphs, bbox) {
  const minJ = bbox ? bbox.minJ : 0, maxJ = bbox ? bbox.maxJ : HW_ROWS - 1;
  const minI = bbox ? bbox.minI : 0, maxI = bbox ? bbox.maxI : HW_COLS - 1;
  for (let j = minJ; j <= maxJ; j++) {
    for (let i = minI; i <= maxI; i++) {
      const o = (j * HW_COLS + i) * 4, a = L[o + 3];
      if (a < 0.12) continue;
      const x = i * HW_CW, y = j * HW_CH;
      let c = [L[o], L[o + 1], L[o + 2]];
      if (depth) c = hwMix(c, hwWater(x, y), depth);
      const flick = hwHash(i, j, Math.floor(t * 7));
      if (a > 0.5) {
        hawaiianCtx.fillStyle = hwRgb(c, depth ? 0.9 : 1);
        hawaiianCtx.fillRect(x + 1, y + 1, HW_CW - 2, HW_CH - 2);
        if (!glyphs) continue;
        const l = hwLum(c), ch = HW_RAMP[Math.max(0, Math.min(HW_RAMP.length - 1, Math.floor(1 + l * 5 + flick * 4)))];
        hawaiianCtx.fillStyle = flick < 0.04 ? HW_SPRINK[(flick * 100) | 0] : hwRgb(l < 0.42 ? hwMix(c, [255, 255, 255], 0.62) : hwMix(c, [0, 0, 0], 0.58), depth ? 0.6 : 1);
        hawaiianCtx.fillText(ch, x + HW_CW / 2, y + HW_CH / 2 + 1);
      } else {
        hawaiianCtx.fillStyle = hwRgb(c, Math.min(1, a * 1.6) * (depth ? 0.6 : 1));
        hawaiianCtx.fillText(HW_EDGE[(flick * HW_EDGE.length) | 0], x + HW_CW / 2, y + HW_CH / 2 + 1);
      }
    }
  }
}

function initHawaiianStatics() {
  if (hw_static_initialized) return;
  hw_static_initialized = true;

  const mk = (cw, ch) => {
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    return [c, c.getContext("2d", { willReadFrequently: true })];
  };

  [hw_oc, hw_ox] = mk(HW_COLS, HW_ROWS);
  [hw_bgc, hw_bgx] = mk(HW_W, HW_H);
  [hw_reefc, hw_reefx] = mk(HW_W, HW_H);

  // 1. Build background gradient & subtle grid
  const g = hw_bgx.createLinearGradient(0, 0, HW_W * 0.45, HW_H * 0.9);
  HW_STOPS.forEach(([k, c]) => g.addColorStop(k, hwRgb(c)));
  hw_bgx.fillStyle = g;
  hw_bgx.fillRect(0, 0, HW_W, HW_H);
  hw_bgx.fillStyle = "rgba(255,255,255,0.07)";
  for (let x = 0; x < HW_W; x += HW_CW) hw_bgx.fillRect(x, 0, 1, HW_H);
  for (let y = 0; y < HW_H; y += HW_CH) hw_bgx.fillRect(0, y, HW_W, 1);

  // 2. Pre-render static reef ONCE into dedicated canvas
  const reefBuf = hwSample((g) => {
    const blob = (x, y, r, c1, c2, n) => { for (let k = 0; k < n; k++) { const a = hwHash(x, y, k) * HW_TAU, d = hwHash(y, x, k) * r * 0.7; hwEll(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, r * (0.35 + 0.3 * hwHash(k, x, y)), r * (0.3 + 0.3 * hwHash(k, y, x)), a, k % 2 ? c1 : c2); } };
    blob(140, 1600, 110, "#d98a6a", "#c46a5a", 10); blob(1800, 220, 100, "#d8b86a", "#c49c4c", 9);
    blob(80, 380, 80, "#c9a0d8", "#e2a0b8", 7); blob(1700, 1650, 110, "#d6b870", "#e8907a", 10);
    for (const [x, y, r, c] of [[300, 1460, 46, "#ff6a3d"], [1520, 1560, 40, "#ff8a2a"], [1900, 420, 36, "#e8483c"], [220, 300, 34, "#ff7a3a"]]) {
      g.save(); g.translate(x, y); g.rotate(hwHash(x, y, 1) * HW_TAU);
      for (let k = 0; k < 5; k++) { g.save(); g.rotate(k * HW_TAU / 5); hwEll(g, r * 0.6, 0, r * 0.65, r * 0.2, 0, c); g.restore(); }
      hwEll(g, 0, 0, r * 0.3, r * 0.3, 0, c); g.restore();
    }
    for (const [x, y] of [[560, 1580], [1740, 1480], [1960, 980], [40, 900]]) { g.save(); g.translate(x, y); for (let k = 0; k < 12; k++) { g.rotate(HW_TAU / 12); hwEll(g, 22, 0, 22, 3, 0, "#3a1f4a"); } hwEll(g, 0, 0, 14, 14, 0, "#2a1438"); g.restore(); }
  });

  hw_reefx.font = '500 15px "Geist Mono", monospace';
  hw_reefx.textAlign = "center";
  hw_reefx.textBaseline = "middle";
  for (let j = 0; j < HW_ROWS; j++) {
    for (let i = 0; i < HW_COLS; i++) {
      const o = (j * HW_COLS + i) * 4, a = reefBuf[o + 3];
      if (a < 0.12) continue;
      const x = i * HW_CW, y = j * HW_CH;
      let c = [reefBuf[o], reefBuf[o + 1], reefBuf[o + 2]];
      c = hwMix(c, hwWater(x, y), 0.62);
      if (a > 0.5) {
        hw_reefx.fillStyle = hwRgb(c, 0.9);
        hw_reefx.fillRect(x + 1, y + 1, HW_CW - 2, HW_CH - 2);
        const l = hwLum(c), ch = HW_RAMP[Math.max(0, Math.min(HW_RAMP.length - 1, Math.floor(1 + l * 5)))];
        hw_reefx.fillStyle = hwRgb(l < 0.42 ? hwMix(c, [255, 255, 255], 0.62) : hwMix(c, [0, 0, 0], 0.58), 0.6);
        hw_reefx.fillText(ch, x + HW_CW / 2, y + HW_CH / 2 + 1);
      } else {
        hw_reefx.fillStyle = hwRgb(c, Math.min(1, a * 1.6) * 0.6);
        hw_reefx.fillText(":", x + HW_CW / 2, y + HW_CH / 2 + 1);
      }
    }
  }
}
let hw_static_initialized = false;

function hwDraw(t) {
  if (!hawaiianCtx) return;
  t = ((t % HW_T) + HW_T) % HW_T;

  // 1. Draw static background & static reef (0.05ms GPU blits)
  hawaiianCtx.drawImage(hw_bgc, 0, 0);
  if (hw_reefc) hawaiianCtx.drawImage(hw_reefc, 0, 0);

  // 2. Sun bands
  hawaiianCtx.save();
  hawaiianCtx.globalCompositeOperation = "screen";
  for (let k = 0; k < 4; k++) {
    const off = ((t / HW_T + k / 4) % 1) * (HW_W + HW_H) * 1.2 - HW_H * 0.6, g = hawaiianCtx.createLinearGradient(off, 0, off + 260, 160);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,240,0.10)"); g.addColorStop(1, "rgba(255,255,255,0)");
    hawaiianCtx.fillStyle = g; hawaiianCtx.fillRect(0, 0, HW_W, HW_H);
  }
  hawaiianCtx.restore();

  hawaiianCtx.font = '500 15px "Geist Mono", monospace';
  hawaiianCtx.textAlign = "center";
  hawaiianCtx.textBaseline = "middle";

  // 3. Waves & sparkles: stepped by 2 for fluid caustics & 75% CPU reduction
  for (let j = 0; j < HW_ROWS; j += 2) {
    for (let i = 0; i < HW_COLS; i += 2) {
      const x = i * HW_CW, y = j * HW_CH;
      const v = Math.sin(x * 0.011 + y * 0.004 + HW_w * 2 * t + 1.6 * Math.sin(y * 0.007 - HW_w * 3 * t))
              + Math.sin(-x * 0.006 + y * 0.012 - HW_w * 3 * t + 1.6 * Math.sin(x * 0.008 + HW_w * 2 * t));
      if (v > 1.45) {
        const k = Math.min(1, (v - 1.45) / 1.2);
        hawaiianCtx.fillStyle = `rgba(255,255,255,${0.18 + 0.4 * k})`;
        hawaiianCtx.fillText(k > 0.6 ? "~" : "-", x + HW_CW / 2, y + HW_CH / 2);
      }
      const gl = hwHash(i, j, Math.floor(t * 6) % 147);
      if (gl > 0.9988) {
        const f = Math.sin(((t * 6) % 1) * Math.PI);
        hawaiianCtx.fillStyle = `rgba(255,255,255,${0.95 * f})`;
        hawaiianCtx.fillText(gl > 0.9995 ? "*" : "+", x + HW_CW / 2, y + HW_CH / 2);
      }
    }
  }

  // 4. Combined Sea Creatures & Deep Whale in single sampling pass
  const main = hwSample((g) => {
    // Deep Whale
    const [wx, wy, wa] = hwPose(HW_P.whale, t);
    hwPut(g, null, t, wx, wy, wa, 1, (g) => hwWhale(g, t));

    // Manta Ray
    let [x, y, a] = hwPose(HW_P.manta, t);
    hwPut(g, null, t, x, y, a, 1.2, (g) => hwManta(g, t));

    // Dolphins
    for (const [dx, ph] of [[0, 0], [1, 1.3]]) {
      [x, y, a] = hwPose(HW_P.dolphin, t - dx * 0.18);
      hwPut(g, null, t, x + dx * 120 * Math.sin(a), y - dx * 120 * Math.cos(a), a, 1.25, (g) => hwDolphin(g, t, ph));
    }

    // Turtles
    [x, y, a] = hwPose(HW_P.turtleA, t); hwPut(g, null, t, x, y, a, 1.55, (g) => hwTurtle(g, t, 1, 0));
    [x, y, a] = hwPose(HW_P.turtleB, t); hwPut(g, null, t, x, y, a, 1.3, (g) => hwTurtle(g, t, 1, 2));
    [x, y, a] = hwPose(HW_P.turtleC, t); hwPut(g, null, t, x, y, a, 1.1, (g) => hwTurtle(g, t, 1, 4));

    // Tang Fish School
    [x, y, a] = hwPose(HW_P.school, t);
    HW_FISH.forEach(([fx, fy], k) => {
      const ca = Math.cos(a), sa = Math.sin(a), wob = 14 * Math.sin(HW_w * 7 * t + k);
      hwPut(g, null, t, x + fx * ca - (fy + wob) * sa, y + fx * sa + (fy + wob) * ca, a + 0.15 * Math.sin(HW_w * 9 * t + k), 1.35, (g) => hwTang(g, t, k));
    });

    // Floating Flowers
    for (const [kind, p0, y0, s, dir] of HW_FLOWERS) {
      const u = (p0 + t / HW_T) % 1, fx = -220 + u * (HW_W + 440), fy = y0 + u * 420 + 30 * Math.sin(HW_w * 3 * t + p0 * 9);
      hwPut(g, null, t, fx, fy, dir * HW_w * t + p0 * 6, 1, (g) => (kind === "h" ? hwHibiscus : hwPlumeria)(g, s));
    }
  });

  // 5. Creature Shadows in active bounding box
  const b = hwBBox;
  hawaiianCtx.fillStyle = "rgba(4,60,84,0.16)";
  for (let j = b.minJ; j <= b.maxJ && j < HW_ROWS - 2; j++) {
    for (let i = b.minI; i <= b.maxI && i < HW_COLS - 2; i++) {
      if (main[(j * HW_COLS + i) * 4 + 3] > 0.3) {
        hawaiianCtx.fillRect((i + 2) * HW_CW, (j + 2) * HW_CH, HW_CW, HW_CH);
      }
    }
  }

  // 6. Bubble Trails
  for (const [fn, len] of [[HW_P.turtleA, 1.5], [HW_P.turtleB, 1.3], [HW_P.turtleC, 1.1], [HW_P.manta, 1.6], [HW_P.dolphin, 1.4]]) {
    for (let k = 1; k <= 12; k++) {
      const [x, y, a] = hwPose(fn, t - k * 0.09 - 0.35 * len), side = (hwHash(k, len, 3) - 0.5) * k * 9;
      const px = x + side * -Math.sin(a), py = y + side * Math.cos(a);
      hawaiianCtx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k / 13)})`;
      hawaiianCtx.fillText(".·o°"[(hwHash(k, len, Math.floor(t * 5)) * 4) | 0], Math.floor(px / HW_CW) * HW_CW + HW_CW / 2, Math.floor(py / HW_CH) * HW_CH + HW_CH / 2);
    }
  }

  // 7. Creature ASCII Cells in active bounding box
  hwCells(main, 0, t, true, b);
}

function resizeHawaiianCanvas() {
  if (!hawaiianCanvas) return;
  const s = Math.max(window.innerWidth / HW_W, window.innerHeight / HW_H);
  hawaiianCanvas.style.transform = `translate(-50%, -50%) scale(${s})`;
}

function updateHawaiianTheme(themeCfg) {
  const isEnabled = !!(themeCfg && themeCfg.hawaiian_theme);

  if (!isEnabled) {
    document.body.classList.remove('tadaza-theme-hawaiian');
    if (hawaiianContainer) {
      hawaiianContainer.style.display = 'none';
    }
    if (hawaiianAnimId) {
      cancelAnimationFrame(hawaiianAnimId);
      hawaiianAnimId = null;
    }
    hawaiianEngineRunning = false;
    return;
  }

  // Enable Theme
  document.body.classList.add('tadaza-theme-hawaiian');
  initHawaiianStatics();

  if (!hawaiianContainer) {
    hawaiianContainer = document.createElement('div');
    hawaiianContainer.id = 'tadaza-hawaiian-container';

    hawaiianCanvas = document.createElement('canvas');
    hawaiianCanvas.id = 'tadaza-hawaiian-canvas';
    hawaiianCanvas.width = HW_W;
    hawaiianCanvas.height = HW_H;
    hawaiianCtx = hawaiianCanvas.getContext('2d');

    hawaiianContainer.appendChild(hawaiianCanvas);
    document.body.prepend(hawaiianContainer);

    window.addEventListener('resize', resizeHawaiianCanvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (hawaiianAnimId) cancelAnimationFrame(hawaiianAnimId);
        hawaiianAnimId = null;
      } else if (hawaiianEngineRunning) {
        hawaiianT0 = performance.now();
        hawaiianLastTime = hawaiianT0;
        hawaiianAnimId = requestAnimationFrame(hawaiianLoop);
      }
    });
  }

  hawaiianContainer.style.display = 'block';
  hawaiianContainer.style.opacity = themeCfg.hawaiian_opacity !== undefined ? themeCfg.hawaiian_opacity : 0.85;
  resizeHawaiianCanvas();

  // Target 15-20 FPS: authentic retro aquarium aesthetic and ensures < 5% CPU usage
  hawaiianTargetFps = Math.min(themeCfg.hawaiian_fps || 15, 20);
  hawaiianFpsInterval = 1000 / hawaiianTargetFps;
  hawaiianEngineRunning = true;

  if (!hawaiianAnimId) {
    hawaiianT0 = performance.now();
    hawaiianLastTime = hawaiianT0;
    hawaiianAnimId = requestAnimationFrame(hawaiianLoop);
  }
}

function hawaiianLoop(now) {
  if (!hawaiianEngineRunning) return;
  hawaiianAnimId = requestAnimationFrame(hawaiianLoop);

  // When window is blurred/unfocused, throttle down to 5 FPS (200ms) to conserve CPU & battery
  const isFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  const effectiveInterval = isFocused ? hawaiianFpsInterval : Math.max(hawaiianFpsInterval, 200);

  const elapsed = now - hawaiianLastTime;
  if (elapsed >= effectiveInterval) {
    hawaiianLastTime = now - (elapsed % effectiveInterval);
    const t = (now - hawaiianT0) / 1000;
    hwDraw(t);
  }
}

/* ==========================================================================
   MODULE: 02_theme_and_privacy_apply.js
   ========================================================================== */

/* --------------------------------------------------------------------------
     2. Apply Configuration to DOM
     -------------------------------------------------------------------------- */
  function applyTheme(cfg) {
    const isDark = cfg.theme.mode === 'dark' || (cfg.theme.mode === 'system' && (cfg._systemIsDark || window.matchMedia('(prefers-color-scheme: dark)').matches));

    if (isDark) {
      document.body.classList.add('dark');
      if (cfg.theme.deep_dark && !cfg.theme.hawaiian_theme) {
        document.body.classList.add('tadaza-deep-dark');
      } else {
        document.body.classList.remove('tadaza-deep-dark');
      }
      try {
        localStorage.setItem('za_theme', JSON.stringify({ theme: 'dark' }));
      } catch (e) { }
    } else {
      document.body.classList.remove('dark');
      document.body.classList.remove('tadaza-deep-dark');
      try {
        localStorage.setItem('za_theme', JSON.stringify({ theme: 'light' }));
      } catch (e) { }
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

    // Dynamic Animated Themes (Hawaiian, Cyberpunk, Sakura, Aurora, Synthwave)
    if (typeof updateDynamicThemes === 'function') {
      updateDynamicThemes(cfg.theme);
    } else if (typeof updateHawaiianTheme === 'function') {
      updateHawaiianTheme(cfg.theme);
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

/* ==========================================================================
   MODULE: 02c_ecosystem_themes.js
   ========================================================================== */

/* --------------------------------------------------------------------------
   2c. Living Ecosystem Dynamic Themes (ASCII / Pixel-Art Simulation)
   - Tropical Rainforest (Cơn Mưa Rừng Nhiệt Đới)
   - Bioluminescent Night Forest (Rừng Ánh Sáng Sinh Học Đêm)
   Engineered in the authentic ASCII-matrix style of Hawaiian Lagoon (< 3% CPU)
   -------------------------------------------------------------------------- */

let ecoAnimId = null;
let ecoEngineRunning = false;
let ecoContainer = null;
let ecoCanvas = null;
let ecoCtx = null;
let ecoLastTime = 0;
let ecoT0 = 0;
let ecoTargetFps = 20;
let ecoFpsInterval = 1000 / 20;
let ecoActiveType = null;

// Geometry matching Hawaiian Lagoon for resolution fidelity
const ECO_W = 1944;
const ECO_H = 1760;
const ECO_CW = 16;
const ECO_CH = 22;
const ECO_COLS = Math.ceil(ECO_W / ECO_CW);
const ECO_ROWS = Math.ceil(ECO_H / ECO_CH);
const ECO_TAU = Math.PI * 2;

// Offscreen buffers for rasterization & statics
let eco_oc, eco_ox, eco_bgc, eco_bgx;
let ecoStaticsBuilt = false;
let ecoCurrentStaticType = null;

const ecoHash = (a, b, c) => {
  let h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return h - Math.floor(h);
};

const ecoMix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ecoRgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const ECO_RAMP = "8%XSSt%t;:";
const ECO_EDGE = "',.o:;";

// ---------------------------------------------------------------------------
// Ecosystem State: Rainforest (Tropical Rain)
// ---------------------------------------------------------------------------
let rainDrops = [];
let rainRipples = [];
let rainFrogs = [];
let rainLilies = [];

function initRainforestState() {
  rainDrops = [];
  for (let i = 0; i < 90; i++) {
    rainDrops.push({
      x: Math.random() * ECO_W,
      y: Math.random() * ECO_H,
      speed: 24 + Math.random() * 18,
      len: 18 + Math.random() * 22,
      thickness: 1 + Math.random() * 1.5,
      alpha: 0.25 + Math.random() * 0.45,
      char: ["/", "|", "'", "!", ":", ";"][(Math.random() * 6) | 0]
    });
  }

  rainRipples = [];
  for (let i = 0; i < 16; i++) {
    rainRipples.push({
      x: 100 + Math.random() * (ECO_W - 200),
      y: 1100 + Math.random() * (ECO_H - 1180),
      r: Math.random() * 50,
      maxR: 35 + Math.random() * 45,
      speed: 0.8 + Math.random() * 0.9,
      alpha: 1
    });
  }

  rainFrogs = [
    { x: 380, y: 1120, scale: 0.9, blinkTimer: 0, breathPhase: 0 },
    { x: 1540, y: 1160, scale: 0.85, blinkTimer: 2, breathPhase: 1.5 }
  ];

  rainLilies = [
    { x: 580, y: 1340, rot: 0.2, driftOffset: 0 },
    { x: 1220, y: 1420, rot: -0.4, driftOffset: 2 }
  ];
}

// ---------------------------------------------------------------------------
// Ecosystem State: Bioforest (Bioluminescent Night Forest)
// ---------------------------------------------------------------------------
let bioSpores = [];
let bioMushrooms = [];
let bioButterflies = [];
let bioFireflies = [];

function initBioforestState() {
  bioSpores = [];
  for (let i = 0; i < 75; i++) {
    bioSpores.push({
      x: Math.random() * ECO_W,
      y: Math.random() * ECO_H,
      speedY: -(0.6 + Math.random() * 1.4),
      speedX: (Math.random() - 0.5) * 0.8,
      size: 6 + Math.random() * 10,
      char: ["✦", "*", "·", "°", "+", "o"][(Math.random() * 6) | 0],
      color: Math.random() > 0.4 ? [6, 214, 160] : [192, 132, 252],
      alpha: 0.3 + Math.random() * 0.6,
      wobbleSpeed: 0.5 + Math.random() * 1.5
    });
  }

  bioMushrooms = [
    { x: 260, y: 1480, scale: 1.2, color: [0, 245, 212], pulsePhase: 0 },
    { x: 420, y: 1540, scale: 0.85, color: [167, 139, 250], pulsePhase: 1.8 },
    { x: 1680, y: 1460, scale: 1.15, color: [6, 214, 160], pulsePhase: 3.2 },
    { x: 1520, y: 1530, scale: 0.9, color: [244, 114, 182], pulsePhase: 4.5 }
  ];

  bioButterflies = [
    { pathFn: (t) => [972 + 650 * Math.sin(t * 0.4), 780 + 320 * Math.cos(t * 0.8) + 80 * Math.sin(t * 1.6)], color: [0, 245, 212] },
    { pathFn: (t) => [972 + 780 * Math.cos(t * 0.35 + 2), 650 + 280 * Math.sin(t * 0.7 + 1)], color: [192, 132, 252] }
  ];

  bioFireflies = [];
  for (let i = 0; i < 24; i++) {
    bioFireflies.push({
      baseX: 100 + Math.random() * (ECO_W - 200),
      baseY: 400 + Math.random() * (ECO_H - 600),
      range: 40 + Math.random() * 60,
      phase: Math.random() * ECO_TAU,
      speed: 0.3 + Math.random() * 0.6
    });
  }
}

// ---------------------------------------------------------------------------
// Build Pre-Rendered Statics (Canopy & Lake for Rain, Ancient Trees for Bio)
// ---------------------------------------------------------------------------
function buildEcoStatics(type) {
  if (ecoStaticsBuilt && ecoCurrentStaticType === type) return;
  ecoCurrentStaticType = type;
  ecoStaticsBuilt = true;

  if (!eco_bgc) {
    eco_bgc = document.createElement("canvas");
    eco_bgc.width = ECO_W;
    eco_bgc.height = ECO_H;
    eco_bgx = eco_bgc.getContext("2d");
  }

  eco_bgx.clearRect(0, 0, ECO_W, ECO_H);

  if (type === 'rainforest') {
    // 1. Deep Rainforest Gradient
    const g = eco_bgx.createLinearGradient(0, 0, 0, ECO_H);
    g.addColorStop(0, "#03160f");
    g.addColorStop(0.55, "#06281c");
    g.addColorStop(0.72, "#042017");
    g.addColorStop(1, "#02120d");
    eco_bgx.fillStyle = g;
    eco_bgx.fillRect(0, 0, ECO_W, ECO_H);

    // 2. Hanging Palm & Monstera Canopy Foliage
    eco_bgx.fillStyle = "rgba(4, 38, 26, 0.85)";
    for (let x = 0; x < ECO_W; x += 180) {
      eco_bgx.beginPath();
      eco_bgx.moveTo(x - 60, 0);
      eco_bgx.quadraticCurveTo(x + 40, 240 + Math.sin(x) * 40, x + 120, 0);
      eco_bgx.fill();
    }

    // 3. Side Rainforest Trunks
    eco_bgx.fillStyle = "#02100a";
    eco_bgx.fillRect(0, 0, 120, ECO_H);
    eco_bgx.fillRect(ECO_W - 120, 0, 120, ECO_H);

    // Subtle ASCII grid texture
    eco_bgx.fillStyle = "rgba(16, 185, 129, 0.04)";
    for (let x = 0; x < ECO_W; x += ECO_CW) eco_bgx.fillRect(x, 0, 1, ECO_H);
    for (let y = 0; y < ECO_H; y += ECO_CH) eco_bgx.fillRect(0, y, ECO_W, 1);

    // Lake Water Surface divider
    eco_bgx.fillStyle = "rgba(16, 185, 129, 0.08)";
    eco_bgx.fillRect(0, 1150, ECO_W, ECO_H - 1150);

  } else if (type === 'bioforest') {
    // 1. Mystic Night Forest Gradient
    const g = eco_bgx.createLinearGradient(0, 0, 0, ECO_H);
    g.addColorStop(0, "#021015");
    g.addColorStop(0.5, "#041a20");
    g.addColorStop(0.78, "#03191a");
    g.addColorStop(1, "#010e11");
    eco_bgx.fillStyle = g;
    eco_bgx.fillRect(0, 0, ECO_W, ECO_H);

    // 2. Ancient Tree Silhouettes & Moss Glade
    eco_bgx.fillStyle = "rgba(2, 16, 20, 0.9)";
    // Left Sacred Tree
    eco_bgx.beginPath();
    eco_bgx.moveTo(0, ECO_H);
    eco_bgx.quadraticCurveTo(180, 900, 80, 0);
    eco_bgx.lineTo(0, 0);
    eco_bgx.fill();

    // Right Sacred Tree
    eco_bgx.beginPath();
    eco_bgx.moveTo(ECO_W, ECO_H);
    eco_bgx.quadraticCurveTo(ECO_W - 180, 950, ECO_W - 70, 0);
    eco_bgx.lineTo(ECO_W, 0);
    eco_bgx.fill();

    // Subtle ASCII grid texture
    eco_bgx.fillStyle = "rgba(6, 214, 160, 0.04)";
    for (let x = 0; x < ECO_W; x += ECO_CW) eco_bgx.fillRect(x, 0, 1, ECO_H);
    for (let y = 0; y < ECO_H; y += ECO_CH) eco_bgx.fillRect(0, y, ECO_W, 1);
  }
}

// ---------------------------------------------------------------------------
// Render Simulation: Tropical Rain (Cơn Mưa Rừng Nhiệt Đới)
// ---------------------------------------------------------------------------
function drawRainforest(ctx, t) {
  ctx.drawImage(eco_bgc, 0, 0);

  ctx.font = '600 15px "JetBrains Mono", Consolas, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 1. Falling Raindrop Streaks in ASCII
  for (const d of rainDrops) {
    d.y += d.speed;
    d.x -= 2.5; // Gentle wind angle

    if (d.y > ECO_H + 20) {
      d.y = -20;
      d.x = Math.random() * (ECO_W + 200);
    }
    if (d.x < -20) d.x = ECO_W + 20;

    const cellX = Math.floor(d.x / ECO_CW) * ECO_CW + ECO_CW / 2;
    const cellY = Math.floor(d.y / ECO_CH) * ECO_CH + ECO_CH / 2;

    ctx.fillStyle = `rgba(110, 231, 183, ${d.alpha})`;
    ctx.fillText(d.char, cellX, cellY);

    // Droplet streak line
    ctx.strokeStyle = `rgba(16, 185, 129, ${d.alpha * 0.6})`;
    ctx.lineWidth = d.thickness;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + 4, d.y - d.len);
    ctx.stroke();
  }

  // 2. Pond Surface Ripples (ASCII Concentric Expanding Rings)
  for (const r of rainRipples) {
    r.r += r.speed;
    if (r.r > r.maxR) {
      r.r = 2;
      r.x = 100 + Math.random() * (ECO_W - 200);
      r.y = 1180 + Math.random() * (ECO_H - 1240);
    }

    const ringAlpha = (1 - r.r / r.maxR) * 0.7;
    const ringGlyph = r.r < 12 ? "." : (r.r < 24 ? "o" : (r.r < 36 ? "O" : "~"));

    ctx.fillStyle = `rgba(167, 243, 208, ${ringAlpha})`;
    for (let a = 0; a < ECO_TAU; a += 0.8) {
      const rx = r.x + Math.cos(a) * r.r * 1.6;
      const ry = r.y + Math.sin(a) * r.r * 0.6;
      ctx.fillText(ringGlyph, Math.floor(rx / ECO_CW) * ECO_CW + ECO_CW / 2, Math.floor(ry / ECO_CH) * ECO_CH + ECO_CH / 2);
    }
  }

  // 3. Resting Tree Frogs (Animated breathing sac & blinking)
  for (const f of rainFrogs) {
    const breath = Math.sin(t * 3 + f.breathPhase) * 4;
    const isBlinking = (Math.sin(t * 0.8 + f.blinkTimer) > 0.95);

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.scale, f.scale);

    // Big Lily Pad Leaf
    ctx.beginPath();
    ctx.ellipse(0, 40, 140, 48, 0, 0, ECO_TAU);
    ctx.fillStyle = "#064e3b";
    ctx.fill();
    ctx.strokeStyle = "#047857";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Frog Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 48 + breath, 34, 0, 0, ECO_TAU);
    ctx.fillStyle = "#10b981";
    ctx.fill();

    // Frog Eyes
    for (const m of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(26 * m, -26, 14, 0, ECO_TAU);
      ctx.fillStyle = "#059669";
      ctx.fill();

      if (!isBlinking) {
        ctx.beginPath();
        ctx.arc(26 * m, -26, 7, 0, ECO_TAU);
        ctx.fillStyle = "#fde047";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(26 * m, -26, 3, 0, ECO_TAU);
        ctx.fillStyle = "#022c22";
        ctx.fill();
      } else {
        ctx.strokeStyle = "#022c22";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18 * m, -26);
        ctx.lineTo(34 * m, -26);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Render Simulation: Bioluminescent Night Forest (Rừng Ánh Sáng Sinh Học Đêm)
// ---------------------------------------------------------------------------
function drawBioforest(ctx, t) {
  ctx.drawImage(eco_bgc, 0, 0);

  ctx.font = '600 15px "JetBrains Mono", Consolas, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 1. Giant Bioluminescent Mushrooms (Pulsing glowing caps)
  for (const m of bioMushrooms) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 1.5 + m.pulsePhase);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(m.scale, m.scale);

    // Glowing Stem
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(-10, -80, -22, -150);
    ctx.lineTo(22, -150);
    ctx.quadraticCurveTo(10, -80, 16, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(4, 40, 48, 0.85)";
    ctx.fill();

    // Giant Bioluminescent Cap
    ctx.beginPath();
    ctx.ellipse(0, -150, 130, 65, 0, Math.PI, 0, false);
    ctx.closePath();
    const capGrad = ctx.createRadialGradient(0, -180, 10, 0, -150, 140);
    capGrad.addColorStop(0, ecoRgb(m.color, 0.95 * pulse));
    capGrad.addColorStop(0.7, ecoRgb(m.color, 0.5 * pulse));
    capGrad.addColorStop(1, "transparent");
    ctx.fillStyle = capGrad;
    ctx.shadowColor = ecoRgb(m.color, 0.9);
    ctx.shadowBlur = 35 * pulse;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Concentric Luminescent Cap Spots (ASCII characters)
    ctx.fillStyle = "#ffffff";
    for (let k = -4; k <= 4; k++) {
      const spotX = k * 24;
      const spotY = -160 - Math.cos(k * 0.4) * 20;
      ctx.fillText(k % 2 === 0 ? "✦" : "·", spotX, spotY);
    }

    ctx.restore();
  }

  // 2. Rising Bioluminescent Spores (Floating upwards like embers)
  for (const s of bioSpores) {
    s.y += s.speedY;
    s.x += Math.sin(t * s.wobbleSpeed + s.y * 0.01) * 1.2 + s.speedX;

    if (s.y < -30) {
      s.y = ECO_H + 20;
      s.x = Math.random() * ECO_W;
    }
    if (s.x > ECO_W + 30) s.x = -20;
    if (s.x < -30) s.x = ECO_W + 20;

    const cellX = Math.floor(s.x / ECO_CW) * ECO_CW + ECO_CW / 2;
    const cellY = Math.floor(s.y / ECO_CH) * ECO_CH + ECO_CH / 2;

    const flick = 0.5 + 0.5 * Math.sin(t * 3 + s.x);
    ctx.fillStyle = ecoRgb(s.color, s.alpha * flick);
    ctx.fillText(s.char, cellX, cellY);
  }

  // 3. Sacred Moon Spirit Butterflies (Fluttering in graceful curved loops)
  for (const b of bioButterflies) {
    const [bx, by] = b.pathFn(t);
    const flap = Math.sin(t * 14);

    ctx.save();
    ctx.translate(bx, by);

    // Glowing aura
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, ECO_TAU);
    ctx.fillStyle = ecoRgb(b.color, 0.25);
    ctx.fill();

    // Butterfly Wings
    for (const m of [-1, 1]) {
      ctx.save();
      ctx.scale(m * flap, 1);
      ctx.beginPath();
      ctx.ellipse(18, -10, 24, 15, 0.4, 0, ECO_TAU);
      ctx.fillStyle = ecoRgb(b.color, 0.85);
      ctx.shadowColor = ecoRgb(b.color, 1);
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 12, 0, 0, ECO_TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  // 4. Fireflies glowing in the moss beds
  for (const ff of bioFireflies) {
    const fx = ff.baseX + Math.sin(t * ff.speed + ff.phase) * ff.range;
    const fy = ff.baseY + Math.cos(t * ff.speed * 0.8 + ff.phase) * (ff.range * 0.5);
    const glow = Math.max(0, Math.sin(t * 2.5 + ff.phase));

    ctx.beginPath();
    ctx.arc(fx, fy, 2.5, 0, ECO_TAU);
    ctx.fillStyle = `rgba(253, 224, 71, ${glow * 0.75})`;
    ctx.shadowColor = "#fde047";
    ctx.shadowBlur = 10 * glow;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ---------------------------------------------------------------------------
// Unified Canvas Loop & Manager
// ---------------------------------------------------------------------------
function resizeEcoCanvas() {
  if (!ecoCanvas) return;
  const s = Math.max(window.innerWidth / ECO_W, window.innerHeight / ECO_H);
  ecoCanvas.style.transform = `translate(-50%, -50%) scale(${s})`;
}

function ecoLoop(now) {
  if (!ecoEngineRunning || !ecoActiveType) return;
  ecoAnimId = requestAnimationFrame(ecoLoop);

  // Throttle down to 5 FPS if unfocused to preserve battery & CPU
  const isFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  const effectiveInterval = isFocused ? ecoFpsInterval : Math.max(ecoFpsInterval, 200);

  const elapsed = now - ecoLastTime;
  if (elapsed >= effectiveInterval) {
    ecoLastTime = now - (elapsed % effectiveInterval);
    const t = (now - ecoT0) / 1000;

    if (ecoActiveType === 'rainforest') {
      drawRainforest(ecoCtx, t);
    } else if (ecoActiveType === 'bioforest') {
      drawBioforest(ecoCtx, t);
    }
  }
}

function stopEcoCanvas() {
  if (ecoAnimId) {
    cancelAnimationFrame(ecoAnimId);
    ecoAnimId = null;
  }
  ecoEngineRunning = false;
  ecoActiveType = null;
  if (ecoContainer) {
    ecoContainer.style.display = 'none';
  }
}

function startEcoCanvas(type, opacity, fps) {
  ecoActiveType = type;
  buildEcoStatics(type);

  if (type === 'rainforest') {
    initRainforestState();
  } else if (type === 'bioforest') {
    initBioforestState();
  }

  if (!ecoContainer) {
    ecoContainer = document.createElement('div');
    ecoContainer.id = 'tadaza-eco-theme-container';
    ecoContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;overflow:hidden;';

    ecoCanvas = document.createElement('canvas');
    ecoCanvas.id = 'tadaza-eco-theme-canvas';
    ecoCanvas.width = ECO_W;
    ecoCanvas.height = ECO_H;
    ecoCanvas.style.cssText = 'position:absolute;top:50%;left:50%;transform-origin:center center;';
    ecoCtx = ecoCanvas.getContext('2d');

    ecoContainer.appendChild(ecoCanvas);
    document.body.prepend(ecoContainer);

    window.addEventListener('resize', resizeEcoCanvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (ecoAnimId) cancelAnimationFrame(ecoAnimId);
        ecoAnimId = null;
      } else if (ecoEngineRunning) {
        ecoT0 = performance.now();
        ecoLastTime = ecoT0;
        ecoAnimId = requestAnimationFrame(ecoLoop);
      }
    });
  }

  ecoContainer.style.display = 'block';
  ecoContainer.style.opacity = opacity !== undefined ? opacity : 0.85;
  resizeEcoCanvas();

  ecoTargetFps = Math.min(fps || 20, 30);
  ecoFpsInterval = 1000 / ecoTargetFps;
  ecoEngineRunning = true;

  if (!ecoAnimId) {
    ecoT0 = performance.now();
    ecoLastTime = ecoT0;
    ecoAnimId = requestAnimationFrame(ecoLoop);
  }
}

// ---------------------------------------------------------------------------
// Global Dispatcher: updateDynamicThemes(themeCfg)
// ---------------------------------------------------------------------------
function updateDynamicThemes(themeCfg) {
  if (!themeCfg) return;

  const ALL_THEME_CLASSES = [
    'tadaza-theme-hawaiian',
    'tadaza-theme-rainforest',
    'tadaza-theme-bioforest'
  ];

  let active = themeCfg.active_preset;
  if (!active) {
    active = themeCfg.hawaiian_theme ? 'hawaiian' : 'none';
  }

  // Remove existing theme classes
  for (const cls of ALL_THEME_CLASSES) {
    document.body.classList.remove(cls);
  }

  const opacity = themeCfg.theme_opacity !== undefined ? themeCfg.theme_opacity : (themeCfg.hawaiian_opacity !== undefined ? themeCfg.hawaiian_opacity : 0.85);
  const fps = themeCfg.theme_fps || themeCfg.hawaiian_fps || 20;

  if (active === 'hawaiian') {
    stopEcoCanvas();
    if (typeof updateHawaiianTheme === 'function') {
      updateHawaiianTheme({
        ...themeCfg,
        hawaiian_theme: true,
        hawaiian_opacity: opacity,
        hawaiian_fps: fps
      });
    }
  } else if (active === 'rainforest' || active === 'bioforest') {
    // Stop Hawaiian if running
    if (typeof updateHawaiianTheme === 'function') {
      updateHawaiianTheme({ ...themeCfg, hawaiian_theme: false });
    }

    document.body.classList.add(`tadaza-theme-${active}`);
    startEcoCanvas(active, opacity, fps);
  } else {
    // None
    stopEcoCanvas();
    if (typeof updateHawaiianTheme === 'function') {
      updateHawaiianTheme({ ...themeCfg, hawaiian_theme: false });
    }
  }
}

/* ==========================================================================
   MODULE: 03_translator.js
   ========================================================================== */

/* --------------------------------------------------------------------------
     3. Quick In-Place Message Translation (Single Floating Hover Button)
     -------------------------------------------------------------------------- */
  let activeHoverMessage = null;

  function extractMessageText(elem) {
    if (!elem) return '';

    // Clone element to safely query and remove metadata nodes without altering DOM
    const clone = elem.cloneNode(true);

    // Remove metadata elements: timestamp, reaction counters/emojis, action menus, quotes
    const selectorsToRemove = [
      '.card-send-time',
      '.card-send-time__sendTime',
      '[class*="send-time"]',
      '[class*="bubble-message-time"]',
      '[class*="chat-timestamp"]',
      '[class*="message-inner-time"]',
      '[class*="reaction"]',
      '[class*="Reaction"]',
      '.tadaza-trans-box',
      '.tadaza-hover-trans-btn',
      '[class*="chat-message__actions"]',
      '[class*="quick-action"]',
      '[class*="MessageQuoteFragment"]',
      '[class*="message-quote"]',
      'svg'
    ];

    selectorsToRemove.forEach(sel => {
      try {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      } catch (e) { }
    });

    const rawText = (clone.innerText || clone.textContent || '').trim();
    if (!rawText) return '';

    // Filter out leaked reaction shortcuts, timestamps, and emoji codes
    const timeRegex = /^(\d{1,2}:\d{2}(?::\d{2})?(\s*(AM|PM|am|pm|Hôm nay|hôm nay|Hôm qua|hôm qua))?|Hôm nay|Hôm qua)$/i;
    const commonReactionCodes = new Set([
      '/-strong', '/-heart', '/-break', '/-fade', '/-thanks', '/-rose', '/-kiss',
      ':>', ':o', ':O', ':-((', ':-h', ':-H', ':-)', ':-(', ';-)', '<3', ':-*', ':D', ':)', ':('
    ]);

    const lines = rawText.split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (!line) return false;
        if (timeRegex.test(line)) return false;
        if (commonReactionCodes.has(line)) return false;
        if (/^\/-[a-zA-Z0-9_-]+$/.test(line)) return false;
        return true;
      });

    return lines.length > 0 ? lines.join('\n').trim() : rawText;
  }

  let isTranslatorInitialized = false;

  function setupMessageTranslator() {
    // Remove any previously created buttons to avoid duplicates
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
        const textToTranslate = extractMessageText(msgElem);
        if (!textToTranslate) return;

        const chatMsg = msgElem.closest('.chat-message, [class*="msg-item"], [class*="chat-item"]');
        const oldBox = (chatMsg || msgElem.parentElement).querySelector('.tadaza-trans-box');
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
          const targetLang = (currentConfig.translate && currentConfig.translate.target_lang) || 'vi';
          const res = await bridge.translate({
            text: textToTranslate,
            targetLang: targetLang
          });

          hoverBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          `;

          const parentToAttach = msgElem.closest('.message-content-render')
            || (chatMsg ? chatMsg.querySelector('.message-content-render') : null)
            || msgElem.closest('.text-message__container')
            || msgElem.closest('[class*="bubble"]')
            || msgElem;

          if (res && res.success && res.translated) {
            const box = document.createElement('div');
            box.className = 'tadaza-trans-box';
            const langLabel = (res.targetLang || targetLang).toUpperCase();
            box.innerHTML = `
              <div class="trans-header">
                <span style="display:flex; align-items:center; gap:4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <span>Bản dịch [${langLabel}]</span>
                </span>
                <span style="cursor:pointer; display:flex; align-items:center; padding:2px;" class="trans-close" title="Đóng">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </span>
              </div>
              <div class="trans-body">${escapeHtml(res.translated)}</div>
              <div style="margin-top:6px; font-size:11px; display:flex; gap:12px; align-items:center;">
                <span class="trans-copy" style="cursor:pointer; color:#0068ff; font-weight:600; display:flex; align-items:center; gap:4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span class="trans-copy-text">Sao chép</span>
                </span>
              </div>
            `;

            box.querySelector('.trans-close').addEventListener('click', (ev) => {
              ev.stopPropagation();
              box.remove();
            });

            const copyBtn = box.querySelector('.trans-copy');
            copyBtn.addEventListener('click', async (ev) => {
              ev.stopPropagation();
              await navigator.clipboard.writeText(res.translated);
              const copyTxt = box.querySelector('.trans-copy-text');
              if (copyTxt) copyTxt.innerText = 'Đã chép!';
              setTimeout(() => {
                if (copyTxt) copyTxt.innerText = 'Sao chép';
              }, 1500);
            });

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            } else {
              msgElem.parentElement.appendChild(box);
            }
          } else {
            console.warn('[TADaZa Translate] No translation result returned:', res);
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

      hoverBtn.addEventListener('mouseenter', () => {
        if (hideTimer) clearTimeout(hideTimer);
      });

      hoverBtn.addEventListener('mouseleave', () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          hoverBtn.style.display = 'none';
        }, 350);
      });
    }

    if (isTranslatorInitialized) return;
    isTranslatorInitialized = true;

    let hideTimer = null;

    window.addEventListener('scroll', () => {
      if (hoverBtn) hoverBtn.style.display = 'none';
    }, true);

    document.addEventListener('mouseover', (e) => {
      if (!currentConfig.translate || !currentConfig.translate.enabled) {
        if (hoverBtn) hoverBtn.style.display = 'none';
        return;
      }

      if (e.target === hoverBtn || (hoverBtn && hoverBtn.contains(e.target))) {
        if (hideTimer) clearTimeout(hideTimer);
        return;
      }

      // Do not trigger hover button on translation box or TADaZa UI elements
      if (e.target.closest && (
        e.target.closest('.tadaza-trans-box') ||
        e.target.closest('#tadaza-drawer') ||
        e.target.closest('#nav-item-tadaza') ||
        e.target.closest('#tadaza-code-studio-overlay') ||
        e.target.closest('#tadaza-vietqr-overlay')
      )) {
        return;
      }

      const bubble = e.target.closest && (
        e.target.closest('.text-message__container') ||
        e.target.closest('.message-content-render') ||
        e.target.closest('[class*="bubble-content"]') ||
        e.target.closest('[class*="msg-content"]') ||
        e.target.closest('[class*="message-content"]')
      );

      const msgText = bubble ? extractMessageText(bubble) : '';
      if (bubble && msgText.length > 0) {
        if (hideTimer) clearTimeout(hideTimer);
        activeHoverMessage = bubble;
        const rect = bubble.getBoundingClientRect();
        hoverBtn.style.display = 'flex';
        let btnLeft = rect.right - 14;
        if (btnLeft + 28 > window.innerWidth) {
          btnLeft = rect.right - 30;
        }
        if (btnLeft < 10) btnLeft = 10;
        const btnTop = Math.max(10, rect.top - 12);
        hoverBtn.style.top = `${btnTop}px`;
        hoverBtn.style.left = `${btnLeft}px`;
      } else {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (hoverBtn) hoverBtn.style.display = 'none';
        }, 350);
      }
    }, true);
  }


  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

/* ==========================================================================
   MODULE: 04_markdown.js
   ========================================================================== */

/* --------------------------------------------------------------------------
     4. Markdown & Code Snippet Feature
     -------------------------------------------------------------------------- */
  const KEYWORDS_BY_LANG = {
    javascript: /\b(const|let|var|function|return|if|else|for|while|switch|case|default|import|export|from|class|extends|new|this|async|await|try|catch|finally|throw|typeof|instanceof|true|false|null|undefined|void|in|of|yield)\b/g,
    typescript: /\b(const|let|var|function|return|if|else|for|while|switch|case|default|import|export|from|class|extends|new|this|async|await|try|catch|finally|throw|typeof|instanceof|true|false|null|undefined|void|in|of|yield|type|interface|enum|implements|public|private|protected|readonly|as|keyof|unknown|any|never)\b/g,
    python: /\b(def|return|if|elif|else|for|while|in|import|from|as|class|try|except|finally|with|lambda|pass|break|continue|True|False|None|and|or|not|is|yield|async|await|self|raise)\b/g,
    go: /\b(func|package|import|return|if|else|for|range|switch|case|default|type|struct|interface|var|const|go|chan|select|defer|nil|true|false|make|len|cap|map|new)\b/g,
    rust: /\b(fn|let|mut|pub|use|mod|struct|enum|impl|trait|for|in|if|else|match|return|loop|while|const|static|type|true|false|self|Self|Some|None|Ok|Err|async|await|move|ref|where|as)\b/g,
    c: /\b(int|float|double|char|void|bool|struct|union|enum|typedef|const|static|extern|return|if|else|for|while|do|switch|case|default|sizeof|NULL|true|false|include|define)\b/g,
    cpp: /\b(int|float|double|char|void|bool|struct|union|enum|typedef|const|static|extern|return|if|else|for|while|do|switch|case|default|sizeof|NULL|true|false|class|public|private|protected|virtual|override|new|delete|namespace|using|std|template|typename|auto)\b/g,
    csharp: /\b(int|string|bool|var|class|struct|interface|enum|public|private|protected|internal|static|readonly|return|if|else|for|foreach|while|switch|case|default|new|try|catch|finally|throw|async|await|using|namespace|get|set|true|false|null|void|override|virtual)\b/g,
    java: /\b(int|double|float|char|boolean|String|class|interface|enum|public|private|protected|static|final|return|if|else|for|while|do|switch|case|default|new|try|catch|finally|throw|throws|package|import|true|false|null|void|override|this|super)\b/g,
    sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|ASC|DESC|LIMIT|OFFSET|AND|OR|NOT|NULL|AS|UNION|ALL|HAVING|IN|LIKE|BETWEEN|DISTINCT|COUNT|SUM|AVG|MAX|MIN|VALUES|SET|PRIMARY|KEY|DATABASE)\b/gi,
    bash: /\b(if|then|fi|else|elif|for|in|do|done|while|until|case|esac|function|echo|export|set|unset|exit|return|local|source|sudo|cd|ls|grep|cat|chmod|chown|curl|wget)\b/g,
    json: /\b(true|false|null)\b/g,
    html: /\b(html|head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|button|input|form|script|style|link|meta|title)\b/g,
    css: /\b(color|background|margin|padding|border|display|flex|grid|width|height|font|position|top|left|right|bottom|overflow|z-index|opacity|transition|transform)\b/g
  };

  function highlightCode(rawCode, rawLang) {
    const lang = (rawLang || '').toLowerCase().trim();
    const kwRegex = KEYWORDS_BY_LANG[lang] || KEYWORDS_BY_LANG['javascript'];
    const lines = (rawCode || '').split('\n');

    const commentPrefix = (lang === 'python' || lang === 'bash') ? '#' : (lang === 'sql' ? '--' : '//');

    const tokenRegex = new RegExp(
      `(${commentPrefix}.*$)|` +
      `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|` +
      `\`(?:\\\\.|[^\`\\\\])*\`)|` +
      `(\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b)|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\\s*\\())|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)|` +
      `([+\\-*/%<>=!&|^~?:]{1,3})|` +
      `([{}()\\[\\],;.])`,
      'g'
    );

    return lines.map((line, lineIdx) => {
      let output = '';
      let lastIndex = 0;
      let match;
      tokenRegex.lastIndex = 0;

      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          output += escapeHtml(line.substring(lastIndex, match.index));
        }
        lastIndex = tokenRegex.lastIndex;

        const [full, comment, str, num, fn, ident, op, punct] = match;
        if (comment) {
          output += `<span class="hl-comment">${escapeHtml(comment)}</span>`;
        } else if (str) {
          output += `<span class="hl-string">${escapeHtml(str)}</span>`;
        } else if (num) {
          output += `<span class="hl-number">${escapeHtml(num)}</span>`;
        } else if (fn) {
          kwRegex.lastIndex = 0;
          if (kwRegex.test(fn)) {
            output += `<span class="hl-keyword">${escapeHtml(fn)}</span>`;
          } else {
            output += `<span class="hl-function">${escapeHtml(fn)}</span>`;
          }
        } else if (ident) {
          kwRegex.lastIndex = 0;
          if (kwRegex.test(ident)) {
            output += `<span class="hl-keyword">${escapeHtml(ident)}</span>`;
          } else {
            output += escapeHtml(ident);
          }
        } else if (op) {
          output += `<span class="hl-operator">${escapeHtml(op)}</span>`;
        } else if (punct) {
          output += `<span class="hl-punctuation">${escapeHtml(punct)}</span>`;
        } else {
          output += escapeHtml(full);
        }
      }

      if (lastIndex < line.length) {
        output += escapeHtml(line.substring(lastIndex));
      }

      return `<div class="tadaza-code-line"><span class="line-num">${lineIdx + 1}</span><span class="line-code">${output || ' '}</span></div>`;
    }).join('');
  }

  function renderSnippetToCanvas(code, lang = 'javascript') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scale = 2; // HiDPI / Retina 2x
    const fontSize = 13 * scale;
    const lineHeight = 22 * scale;
    const paddingX = 22 * scale;
    const headerHeight = 42 * scale;
    const paddingBottom = 18 * scale;

    const lines = (code || '').split('\n');
    const maxLineCount = lines.length;
    const lineNumWidth = (String(maxLineCount).length * 9 + 14) * scale;

    ctx.font = `500 ${fontSize}px 'JetBrains Mono', 'Fira Code', 'DejaVu Sans Mono', Consolas, monospace`;
    let maxTextWidth = 0;
    for (const l of lines) {
      const w = ctx.measureText(l).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const minWidth = 440 * scale;
    const contentWidth = Math.max(minWidth, lineNumWidth + maxTextWidth + paddingX * 2);
    const cardWidth = Math.min(contentWidth, 1400 * scale);
    const cardHeight = headerHeight + (lines.length * lineHeight) + paddingBottom;

    const outerPad = 28 * scale;
    canvas.width = cardWidth + outerPad * 2;
    canvas.height = cardHeight + outerPad * 2;

    // 1. Draw Canvas background gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#1e1e2e');
    grad.addColorStop(0.5, '#181825');
    grad.addColorStop(1, '#11111b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Window Card Shadow
    const cardX = outerPad;
    const cardY = outerPad;
    const radius = 12 * scale;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 24 * scale;
    ctx.shadowOffsetY = 10 * scale;

    ctx.fillStyle = '#181825';
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, radius);
    ctx.fill();
    ctx.restore();

    // Card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1 * scale;
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, radius);
    ctx.stroke();

    // 3. Header Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardWidth - radius, cardY);
    ctx.arcTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius, radius);
    ctx.lineTo(cardX + cardWidth, cardY + headerHeight);
    ctx.lineTo(cardX, cardY + headerHeight);
    ctx.lineTo(cardX, cardY + radius);
    ctx.arcTo(cardX, cardY, cardX + radius, cardY, radius);
    ctx.closePath();
    ctx.fill();

    // 3 macOS dots
    const dotY = cardY + headerHeight / 2;
    const dotR = 5.5 * scale;
    // Red
    ctx.fillStyle = '#ff5f56';
    ctx.beginPath();
    ctx.arc(cardX + 18 * scale, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    // Yellow
    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath();
    ctx.arc(cardX + 34 * scale, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    // Green
    ctx.fillStyle = '#27c93f';
    ctx.beginPath();
    ctx.arc(cardX + 50 * scale, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Language Title
    ctx.font = `600 ${11 * scale}px 'Inter', sans-serif`;
    ctx.fillStyle = '#a6adc8';
    ctx.textAlign = 'center';
    const langObj = SUPPORTED_LANGS.find(l => l.id === lang);
    const titleText = (langObj ? langObj.name : (lang || 'CODE').toUpperCase());
    ctx.fillText(titleText, cardX + cardWidth / 2, dotY + 4 * scale);

    // 4. Draw Code lines
    ctx.textAlign = 'left';
    const kwRegex = KEYWORDS_BY_LANG[lang] || KEYWORDS_BY_LANG['javascript'];
    const commentPrefix = (lang === 'python' || lang === 'bash') ? '#' : (lang === 'sql' ? '--' : '//');

    const tokenRegex = new RegExp(
      `(${commentPrefix}.*$)|` +
      `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|` +
      `\`(?:\\\\.|[^\`\\\\])*\`)|` +
      `(\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b)|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\\s*\\())|` +
      `(\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)|` +
      `([+\\-*/%<>=!&|^~?:]{1,3})|` +
      `([{}()\\[\\],;.])`,
      'g'
    );

    lines.forEach((line, idx) => {
      const y = cardY + headerHeight + (idx + 1) * lineHeight - 5 * scale;

      // Line number
      ctx.font = `400 ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#585b70';
      ctx.fillText(String(idx + 1).padStart(String(maxLineCount).length, ' '), cardX + paddingX, y);

      // Code tokens
      let cursorX = cardX + paddingX + lineNumWidth;
      let lastIndex = 0;
      let match;
      tokenRegex.lastIndex = 0;

      ctx.font = `500 ${fontSize}px 'JetBrains Mono', 'Fira Code', monospace`;

      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          const text = line.substring(lastIndex, match.index);
          ctx.fillStyle = '#cdd6f4';
          ctx.fillText(text, cursorX, y);
          cursorX += ctx.measureText(text).width;
        }
        lastIndex = tokenRegex.lastIndex;

        const [full, comment, str, num, fn, ident, op, punct] = match;
        let tokenColor = '#cdd6f4';

        if (comment) tokenColor = '#6c7086';
        else if (str) tokenColor = '#a6e3a1';
        else if (num) tokenColor = '#fab387';
        else if (fn) {
          kwRegex.lastIndex = 0;
          tokenColor = kwRegex.test(fn) ? '#cba6f7' : '#89b4fa';
        } else if (ident) {
          kwRegex.lastIndex = 0;
          tokenColor = kwRegex.test(ident) ? '#cba6f7' : '#cdd6f4';
        } else if (op) tokenColor = '#89dceb';
        else if (punct) tokenColor = '#9399b2';

        ctx.fillStyle = tokenColor;
        ctx.fillText(full, cursorX, y);
        cursorX += ctx.measureText(full).width;
      }

      if (lastIndex < line.length) {
        const rest = line.substring(lastIndex);
        ctx.fillStyle = '#cdd6f4';
        ctx.fillText(rest, cursorX, y);
      }
    });

    return canvas;
  }

  function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  function formatInlineMarkdown(text) {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/`([^`\n]+)`/g, '<span class="tadaza-inline-code">$1</span>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    escaped = escaped.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return escaped;
  }

  function createCodeCardElement(code, lang) {
    const card = document.createElement('div');
    card.className = 'tadaza-code-card';

    const langObj = SUPPORTED_LANGS.find(l => l.id === (lang || '').toLowerCase());
    const langDisplay = langObj ? langObj.name.split(' ')[0] : (lang || 'CODE').toUpperCase();

    const highlightedHtml = highlightCode(code, lang);

    card.innerHTML = `
      <div class="tadaza-code-header">
        <div class="mac-dots">
          <span class="mac-dot mac-dot-red"></span>
          <span class="mac-dot mac-dot-yellow"></span>
          <span class="mac-dot mac-dot-green"></span>
        </div>
        <span class="tadaza-code-lang">${escapeHtml(langDisplay)}</span>
        <div class="tadaza-code-actions">
          <button class="tadaza-btn-copy-code" title="Sao chép toàn bộ code">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="btn-text">Sao chép</span>
          </button>
          <button class="tadaza-btn-copy-img" title="Sao chép ảnh snippet đẹp">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span class="btn-text">Ảnh</span>
          </button>
        </div>
      </div>
      <pre class="tadaza-code-content"><code>${highlightedHtml}</code></pre>
    `;

    // Copy Code button
    const copyBtn = card.querySelector('.tadaza-btn-copy-code');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(code);
        const textSpan = copyBtn.querySelector('.btn-text');
        textSpan.textContent = 'Đã chép!';
        setTimeout(() => { if (copyBtn.querySelector('.btn-text')) copyBtn.querySelector('.btn-text').textContent = 'Sao chép'; }, 1500);
      } catch (err) {
        console.warn('[TADaZa] Copy code failed:', err);
      }
    });

    // Copy Image button
    const imgBtn = card.querySelector('.tadaza-btn-copy-img');
    imgBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const canvas = renderSnippetToCanvas(code, lang);
        const dataUri = canvas.toDataURL('image/png');
        await bridge.copyImage(dataUri);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } catch (e) { }
          }
          const textSpan = imgBtn.querySelector('.btn-text');
          textSpan.textContent = 'Đã chép!';
          setTimeout(() => { if (imgBtn.querySelector('.btn-text')) imgBtn.querySelector('.btn-text').textContent = 'Ảnh'; }, 1500);
        }, 'image/png');
      } catch (err) {
        console.warn('[TADaZa] Copy image failed:', err);
      }
    });

    return card;
  }

  function formatMarkdownContent(element) {
    if (!currentConfig.markdown || !currentConfig.markdown.enabled) return;
    if (element.hasAttribute('data-tadaza-md')) return;
    if (element.querySelector('.tadaza-code-card')) return;

    // Check inner text
    const rawText = element.textContent || '';
    const codeBlockRegex = /```(?:([a-zA-Z0-9_+-]+)\n)?([\s\S]*?)```/g;
    const hasCodeBlocks = codeBlockRegex.test(rawText);
    const hasInline = /`[^`\n]+`|\*\*[^*]+\*\*|~~[^~]+~~/.test(rawText);

    if (!hasCodeBlocks && (!hasInline || !currentConfig.markdown.auto_format_inline)) {
      return;
    }

    if (element.querySelector('.text-message__container') || element.querySelector('[class*="bubble-content"]')) {
      return;
    }

    element.setAttribute('data-tadaza-md', '1');

    // Preserve time element if present
    const timeElem = element.querySelector('[class*="bubble-message-time"], [class*="message-inner-time"]');

    if (hasCodeBlocks) {
      codeBlockRegex.lastIndex = 0;
      const parts = [];
      let lastIdx = 0;
      let match;
      while ((match = codeBlockRegex.exec(rawText)) !== null) {
        if (match.index > lastIdx) {
          parts.push({ type: 'text', content: rawText.substring(lastIdx, match.index) });
        }
        lastIdx = codeBlockRegex.lastIndex;
        parts.push({ type: 'code', lang: match[1] || 'javascript', code: match[2] });
      }
      if (lastIdx < rawText.length) {
        parts.push({ type: 'text', content: rawText.substring(lastIdx) });
      }

      element.innerHTML = '';
      for (const part of parts) {
        if (part.type === 'text') {
          const textSpan = document.createElement('span');
          if (currentConfig.markdown.auto_format_inline) {
            textSpan.innerHTML = formatInlineMarkdown(part.content);
          } else {
            textSpan.textContent = part.content;
          }
          element.appendChild(textSpan);
        } else if (part.type === 'code') {
          const card = createCodeCardElement(part.code, part.lang);
          element.appendChild(card);
        }
      }
      if (timeElem) element.appendChild(timeElem);
    } else if (currentConfig.markdown.auto_format_inline && hasInline) {
      element.innerHTML = formatInlineMarkdown(rawText);
      if (timeElem) element.appendChild(timeElem);
    }
  }

  function setupMessageCodeFormatter() {
    let scanTimeout = null;
    const scanMessages = () => {
      if (!currentConfig.markdown || !currentConfig.markdown.enabled) return;

      const targets = document.querySelectorAll(
        '.text-message__container:not([data-tadaza-md]), ' +
        '[class*="bubble-content"]:not([data-tadaza-md]), ' +
        '[class*="msg-content"]:not([data-tadaza-md])'
      );

      targets.forEach(elem => {
        if (elem.closest('.tadaza-trans-box') || elem.closest('#tadaza-code-studio-overlay')) return;
        formatMarkdownContent(elem);
      });
    };

    scanMessages();

    const observer = new MutationObserver(() => {
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanMessages, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function insertTextIntoChatInput(text) {
    const richInput = document.querySelector('[id^="richInput"]') || document.getElementById('richInput') || document.querySelector('.rich-input');
    if (!richInput) return;
    richInput.focus();
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      richInput.innerText = (richInput.innerText ? richInput.innerText + '\n' : '') + text;
      richInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  async function pasteImageBlobIntoZalo(blob) {
    const richInput = document.querySelector('[id^="richInput"]') || document.getElementById('richInput') || document.querySelector('.rich-input');
    if (!richInput) return false;
    richInput.focus();
    try {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      document.execCommand('paste');
      return true;
    } catch (e) {
      try {
        const file = new File([blob], 'snippet.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const pasteEv = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        });
        richInput.dispatchEvent(pasteEv);
        return true;
      } catch (err2) {
        console.error('[TADaZa] Failed to paste snippet image:', err2);
        return false;
      }
    }
  }

  let studioModal = null;

  function openCodeStudioModal(initialCode = '', initialLang = 'javascript') {
    if (!studioModal) {
      studioModal = document.createElement('div');
      studioModal.id = 'tadaza-code-studio-overlay';
      document.body.appendChild(studioModal);
    }

    studioModal.innerHTML = `
      <div id="tadaza-code-studio-modal">
        <div class="tadaza-modal-header">
          <div class="tadaza-modal-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#89b4fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <span>TADaZa Code & Markdown Studio</span>
          </div>
          <div class="tadaza-modal-controls">
            <select class="tadaza-select" id="tadaza-studio-lang" style="min-width: 160px; font-size: 12px; padding: 4px 10px;">
              ${SUPPORTED_LANGS.map(l => `<option value="${l.id}" ${l.id === initialLang ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
            <button class="tadaza-close-btn" id="tadaza-studio-close" title="Đóng">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="tadaza-modal-body">
          <div class="tadaza-modal-pane editor-pane">
            <div class="tadaza-pane-header">
              <span>Trình soạn thảo mã (Editor)</span>
              <span style="font-size: 11px; opacity: 0.7;">Phím tắt: Tab để thụt dòng</span>
            </div>
            <textarea class="tadaza-code-textarea" id="tadaza-studio-editor" placeholder="// Dán hoặc gõ mã nguồn của bạn vào đây...&#10;function helloWorld() {&#10;  console.log('Hello from Zalo Linux!');&#10;}" spellcheck="false">${escapeHtml(initialCode)}</textarea>
          </div>

          <div class="tadaza-modal-pane preview-pane">
            <div class="tadaza-pane-header">
              <span>Xem trước ảnh Snippet (Carbon Style)</span>
              <span style="font-size: 11px; opacity: 0.7;">Độ phân giải 2x Retina</span>
            </div>
            <div class="tadaza-preview-container" id="tadaza-studio-preview-box"></div>
          </div>
        </div>

        <div class="tadaza-modal-footer">
          <button class="tadaza-action-btn secondary" id="tadaza-studio-btn-cancel">Hủy</button>
          <div class="tadaza-modal-btn-group">
            <button class="tadaza-action-btn secondary" id="tadaza-studio-btn-insert-text" title="Chèn markdown block vào ô chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 7 4 4 20 4 20 7"></polyline>
                <line x1="9" y1="20" x2="15" y2="20"></line>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
              <span>Chèn vào ô chat</span>
            </button>
            <button class="tadaza-action-btn secondary" id="tadaza-studio-btn-copy-img" title="Sao chép ảnh vào bộ nhớ tạm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="label-studio-copy-img">Sao chép ảnh</span>
            </button>
            <button class="tadaza-action-btn tadaza-btn-send-img" id="tadaza-studio-btn-send-img" title="Tự động dán ảnh vào khung chat Zalo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <span>Gửi dạng ảnh Snippet</span>
            </button>
          </div>
        </div>
      </div>
    `;

    studioModal.classList.add('open');

    const editor = studioModal.querySelector('#tadaza-studio-editor');
    const langSelect = studioModal.querySelector('#tadaza-studio-lang');
    const previewBox = studioModal.querySelector('#tadaza-studio-preview-box');
    const closeBtn = studioModal.querySelector('#tadaza-studio-close');
    const cancelBtn = studioModal.querySelector('#tadaza-studio-btn-cancel');
    const insertTextBtn = studioModal.querySelector('#tadaza-studio-btn-insert-text');
    const copyImgBtn = studioModal.querySelector('#tadaza-studio-btn-copy-img');
    const sendImgBtn = studioModal.querySelector('#tadaza-studio-btn-send-img');

    let currentCanvas = null;

    const updatePreview = () => {
      const code = editor.value || '// Không có mã nào';
      const lang = langSelect.value;
      currentCanvas = renderSnippetToCanvas(code, lang);
      currentCanvas.className = 'tadaza-canvas-preview';
      currentCanvas.style.maxWidth = '100%';
      currentCanvas.style.height = 'auto';
      previewBox.innerHTML = '';
      previewBox.appendChild(currentCanvas);
    };

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        updatePreview();
      }
    });

    editor.addEventListener('input', updatePreview);
    langSelect.addEventListener('change', updatePreview);

    updatePreview();
    setTimeout(() => editor.focus(), 100);

    const closeModal = () => {
      studioModal.classList.remove('open');
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    studioModal.addEventListener('click', (e) => {
      if (e.target === studioModal) closeModal();
    });

    insertTextBtn.addEventListener('click', () => {
      const code = editor.value.trim();
      if (!code) return;
      const lang = langSelect.value;
      const markdown = `\`\`\`${lang}\n${code}\n\`\`\``;
      insertTextIntoChatInput(markdown);
      closeModal();
    });

    copyImgBtn.addEventListener('click', async () => {
      if (!currentCanvas) return;
      const dataUri = currentCanvas.toDataURL('image/png');
      await bridge.copyImage(dataUri);
      currentCanvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch (e) { }
        }
        const label = studioModal.querySelector('#label-studio-copy-img');
        if (label) {
          label.textContent = 'Đã chép!';
          setTimeout(() => { if (label) label.textContent = 'Sao chép ảnh'; }, 1500);
        }
      }, 'image/png');
    });

    sendImgBtn.addEventListener('click', async () => {
      if (!currentCanvas) return;
      const dataUri = currentCanvas.toDataURL('image/png');
      await bridge.copyImage(dataUri);
      currentCanvas.toBlob(async (blob) => {
        if (!blob) return;
        closeModal();
        await pasteImageBlobIntoZalo(blob);
      }, 'image/png');
    });
  }

  function setupChatToolbarButton() {
    // Keep chat messaging toolbar clean - remove any injected code studio icons
    const existing = document.getElementById('tadaza-btn-code-studio');
    if (existing) existing.remove();
  }

  function setupInputMarkdownShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        let selectedText = '';
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          selectedText = selection.toString();
        }
        openCodeStudioModal(selectedText);
      }
    });
  }

/* ==========================================================================
   MODULE: 05_quick_parser.js
   ========================================================================== */

/* --------------------------------------------------------------------------
     5. Quick Parser Feature (Bank STK, VietQR, Tracking & Phone Detection)
     -------------------------------------------------------------------------- */
  const VIETNAM_BANKS = [
    { bin: '970436', shortName: 'VCB', code: 'vietcombank', name: 'Vietcombank', aliases: ['vietcombank', 'vcb', 'vietcom'] },
    { bin: '970407', shortName: 'TCB', code: 'techcombank', name: 'Techcombank', aliases: ['techcombank', 'tcb', 'techcom'] },
    { bin: '970422', shortName: 'MB', code: 'mbbank', name: 'MBBank', aliases: ['mbbank', 'mb', 'quan doi'] },
    { bin: '970432', shortName: 'VPB', code: 'vpbank', name: 'VPBank', aliases: ['vpbank', 'vpb', 'vp'] },
    { bin: '970416', shortName: 'ACB', code: 'acb', name: 'ACB', aliases: ['acb', 'a chau'] },
    { bin: '970418', shortName: 'BIDV', code: 'bidv', name: 'BIDV', aliases: ['bidv'] },
    { bin: '970441', shortName: 'VIB', code: 'vib', name: 'VIB', aliases: ['vib', 'quoc te'] },
    { bin: '970423', shortName: 'TPB', code: 'tpbank', name: 'TPBank', aliases: ['tpbank', 'tpb', 'tien phong'] },
    { bin: '970415', shortName: 'CTG', code: 'vietinbank', name: 'VietinBank', aliases: ['vietinbank', 'ctg', 'vietin'] },
    { bin: '970403', shortName: 'STB', code: 'sacombank', name: 'Sacombank', aliases: ['sacombank', 'stb', 'sacom'] },
    { bin: '970437', shortName: 'HDB', code: 'hdbank', name: 'HDBank', aliases: ['hdbank', 'hdb'] },
    { bin: '970448', shortName: 'OCB', code: 'ocb', name: 'OCB', aliases: ['ocb', 'phuong dong'] },
    { bin: '970443', shortName: 'SHB', code: 'shb', name: 'SHB', aliases: ['shb'] },
    { bin: '970426', shortName: 'MSB', code: 'msb', name: 'MSB', aliases: ['msb', 'hang hai'] },
    { bin: '970449', shortName: 'LPB', code: 'lpbank', name: 'LPBank', aliases: ['lpbank', 'lpb', 'lienvietpostbank', 'lienviet'] },
    { bin: '970440', shortName: 'SeABank', code: 'seabank', name: 'SeABank', aliases: ['seabank', 'sea'] },
    { bin: '970424', shortName: 'Shinhan', code: 'shinhanbank', name: 'Shinhan Bank', aliases: ['shinhan', 'shinhanbank'] },
    { bin: '546034', shortName: 'Cake', code: 'cake', name: 'Cake by VPBank', aliases: ['cake'] },
    { bin: '963388', shortName: 'Timo', code: 'timo', name: 'Timo', aliases: ['timo'] },
    { bin: '971005', shortName: 'ViettelMoney', code: 'viettelmoney', name: 'Viettel Money', aliases: ['viettelmoney', 'viettelpay', 'viettel'] },
    { bin: '971011', shortName: 'VNPTMoney', code: 'vnptmoney', name: 'VNPT Money', aliases: ['vnptmoney', 'vnpt'] }
  ];

  const TRACKING_PATTERNS = [
    {
      carrier: 'Shopee Express (SPX)',
      code: 'spx',
      regex: /\b(SPXVN[0-9A-Za-z]{8,14}|VN\d{12,15}[A-Za-z]?)\b/i,
      url: (c) => `https://spx.vn/track?tracking_number=${c}`
    },
    {
      carrier: 'Giao Hàng Tiết Kiệm (GHTK)',
      code: 'ghtk',
      regex: /(?:ghtk|tiết\s*kiệm)[^\d]{0,20}([0-9]{9,11}|S\d+\.[A-Za-z0-9.]+)\b/i,
      url: (c) => `https://i.ghtk.vn/${c}`
    },
    {
      carrier: 'Viettel Post',
      code: 'viettelpost',
      regex: /(?:viettel|vtp)[^\d]{0,20}(VT[0-9A-Za-z]{9,12}|[0-9]{9,12})\b/i,
      url: (c) => `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?order_number=${c}`
    },
    {
      carrier: 'J&T Express',
      code: 'jtexpress',
      regex: /(?:j&t|jnt)[^\d]{0,20}([0-9]{10,12}|JNT[0-9A-Za-z]{8,12})\b/i,
      url: (c) => `https://jtexpress.vn/vi/tracking?type=track&billcode=${c}`
    }
  ];

  const BANK_STOP_WORDS = new Set([
    'ck', 'cho', 'tao', 'to', 'tớ', 'minh', 'mình', 'ban', 'bạn', 'anh', 'em', 'chi', 'chị',
    'vao', 'vào', 'qua', 'sang', 'gui', 'gửi', 'ho', 'hộ', 'nhe', 'nhé', 'nha', 'cai', 'cái',
    'nay', 'này', 'thi', 'thì', 'no', 'nó', 'khong', 'không', 'nhan', 'nhận', 'duoc', 'được',
    'tien', 'tiền', 'chuyen', 'chuyển', 'khoan', 'khoản', 'so', 'số', 'tai', 'tài', 'bao',
    'nhieu', 'nhiều', 'voi', 'với', 'ok', 'rep', 'giup', 'giúp', 'di', 'đi', 'roi', 'rồi', 'xong',
    'chua', 'chưa', 'ngay', 'hom', 'hôm', 'gio', 'giờ', 'tk', 'stk', 'gia', 'giá', 'fix', 'bot',
    'bớt', 'shop', 'bac', 'bác', 'ong', 'ông', 'chu', 'chú', 'noi', 'nội', 'dung',
    'la', 'là', 'cua', 'của', 'day', 'đây', 'ạ', 'a'
  ]);

  function parseBankInfo(text) {
    if (!text || typeof text !== 'string') return null;
    const textLower = text.toLowerCase();

    // 1. Identify amount first
    let amount = null;
    let amountRawStr = '';
    const amtMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(k|củ|tr|triệu|đ|d|vnd|dong|đồng)\b/i);
    if (amtMatch) {
      amountRawStr = amtMatch[0];
      const numStr = amtMatch[1].replace(/\./g, '').replace(/,/g, '.');
      const unit = amtMatch[2].toLowerCase();
      const val = parseFloat(numStr);
      if (unit === 'k') amount = Math.round(val * 1000);
      else if (['tr', 'triệu', 'củ'].includes(unit)) amount = Math.round(val * 1000000);
      else amount = Math.round(val);
    } else {
      const amtMatch2 = text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
      if (amtMatch2) {
        const num = amtMatch2[1].replace(/[.,]/g, '');
        if (parseInt(num, 10) >= 1000) {
          amount = parseInt(num, 10);
          amountRawStr = amtMatch2[0];
        }
      }
    }

    // 2. Identify bank
    let foundBank = null;
    let bankMatchIndex = -1;
    let bankMatchLength = 0;
    for (const b of VIETNAM_BANKS) {
      for (const a of b.aliases) {
        const reg = new RegExp(`\\b${a}\\b`, 'i');
        const m = textLower.match(reg);
        if (m) {
          foundBank = b;
          bankMatchIndex = m.index;
          bankMatchLength = m[0].length;
          break;
        }
      }
      if (foundBank) break;
    }

    const hasBankKeyword = /\b(stk|số\s*tk|tài\s*khoản|chuyển\s*khoản|ck|c\/k|alias|nickname)\b/i.test(textLower);
    if (!foundBank && !hasBankKeyword) return null;

    // Helper: validate account candidate (digits or alphanumeric alias)
    function isValidAccountCandidate(candidate, rawOriginalWord) {
      if (!candidate || typeof candidate !== 'string') return false;
      const candLower = candidate.toLowerCase();
      if (VIETNAM_BANKS.some(b => b.aliases.includes(candLower))) return false;
      if (BANK_STOP_WORDS.has(candLower)) return false;
      if (amountRawStr && (candidate === amountRawStr || candLower === amountRawStr.toLowerCase())) return false;
      if (/^\d+(k|tr|cu|củ|vnd|d|đ)?$/i.test(candLower) && candLower.endsWith('k')) return false;
      // If the original token in text has Vietnamese accents (e.g., "chuyển" -> "chuy"), it is NOT an alias
      if (rawOriginalWord && /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(rawOriginalWord)) {
        return false;
      }
      if (candidate.length < 4 || candidate.length > 25) return false;
      return true;
    }

    // 3. Identify account number or alias
    let accountNo = null;

    // Pattern A: Explicit prefix (stk, tk, số tk, tài khoản, alias, nickname)
    const prefixRegex = /(?:stk|số\s*tk|tk|tài\s*khoản|alias|nickname|nick)[\s:]+([A-Za-z0-9_.-]{4,25})\b/i;
    const pMatch = text.match(prefixRegex);
    if (pMatch) {
      const candidate = pMatch[1];
      const fullWordMatch = text.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
      const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
      if (isValidAccountCandidate(candidate, fullWord)) {
        accountNo = candidate;
      }
    }

    // Pattern B: Traditional numeric STK (6-19 digits)
    if (!accountNo) {
      const numericCandidates = text.match(/\b[0-9]{6,19}\b/g);
      if (numericCandidates && numericCandidates.length > 0) {
        for (const num of numericCandidates) {
          if (amount && (num === String(amount) || num === amountRawStr.replace(/[.,]/g, ''))) {
            continue;
          }
          accountNo = num;
          break;
        }
      }
    }

    // Pattern C: If bank was found, check adjacent/nearby tokens for Nickname/Alias
    if (!accountNo && foundBank) {
      // Check right after bank: e.g. "tpbank nobianh78" or "tpbank : nobianh78" or "tpbank stk nobianh78"
      const afterBankStr = text.substring(bankMatchIndex + bankMatchLength);
      const afterMatch = afterBankStr.match(/^[\s:,-]*(?:stk|tk|la|là|cua|của|so|số|nick|alias)?[\s:,-]*([A-Za-z0-9_.-]{4,25})\b/i);
      if (afterMatch) {
        const candidate = afterMatch[1];
        const fullWordMatch = afterBankStr.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
        const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
        if (isValidAccountCandidate(candidate, fullWord)) {
          const hasDigits = /\d/.test(candidate);
          if (hasDigits || hasBankKeyword || amount || candidate.length >= 6) {
            accountNo = candidate;
          }
        }
      }

      // Check right before bank: e.g. "nobianh78 tpbank"
      if (!accountNo) {
        const beforeBankStr = text.substring(0, bankMatchIndex);
        const beforeMatch = beforeBankStr.match(/([A-Za-z0-9_.-]{4,25})[\s:,-]*$/i);
        if (beforeMatch) {
          const candidate = beforeMatch[1];
          const fullWordMatch = beforeBankStr.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
          const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
          if (isValidAccountCandidate(candidate, fullWord)) {
            const hasDigits = /\d/.test(candidate);
            if (hasDigits || hasBankKeyword || amount || candidate.length >= 6) {
              accountNo = candidate;
            }
          }
        }
      }
    }

    if (!accountNo) return null;

    // 4. Identify Account Name (Title Case or UPPERCASE 2-5 words)
    let accountName = '';
    let cleanedForName = text.replace(new RegExp(accountNo, 'g'), '');
    cleanedForName = cleanedForName.replace(/\b\d+([.,]\d+)?\s*(k|củ|tr|triệu|đ|d|vnd|dong|đồng)?\b/gi, '');
    cleanedForName = cleanedForName.replace(/(?:^|\s+)(?:stk|số\s*tk|tk|tài\s*khoản|chuyển\s*khoản|ck|tiền|c\/k|vao|vào|cho|to|tớ|minh|mình|nhé|nha|vcb|tcb|mb|bidv|acb|vietcombank|techcombank|mbbank|tpbank)(?=\s+|$)/gi, ' ');
    const nameMatches = cleanedForName.match(/\b[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){1,4}\b/g);
    if (nameMatches && nameMatches.length > 0) {
      const valid = nameMatches.filter(n => {
        const words = n.trim().split(/\s+/);
        return words.length >= 2 && words.every(w => /^[A-ZÀ-Ỹ]/.test(w));
      });
      if (valid.length > 0) {
        accountName = valid.reduce((a, b) => a.length >= b.length ? a : b).trim();
      }
    }

    return {
      bank: foundBank || { bin: '970436', shortName: 'BANK', code: 'vietcombank', name: 'Ngân hàng' },
      accountNo,
      amount,
      accountName
    };
  }

  function parseTrackingInfo(text) {
    if (!text || typeof text !== 'string') return null;
    for (const item of TRACKING_PATTERNS) {
      const m = text.match(item.regex);
      if (m) {
        const code = m[1];
        return {
          carrier: item.carrier,
          code,
          url: item.url(code)
        };
      }
    }
    const spxMatch = text.match(/\b(SPXVN[0-9A-Za-z]{8,14})\b/i);
    if (spxMatch) {
      const code = spxMatch[1];
      return {
        carrier: 'Shopee Express (SPX)',
        code,
        url: `https://spx.vn/track?tracking_number=${code}`
      };
    }
    return null;
  }

  function parsePhoneNumber(text) {
    if (!text || typeof text !== 'string') return null;
    const m = text.match(/\b(?:\+84|0)(?:3|5|7|8|9)\d{8}\b/);
    return m ? m[0] : null;
  }

  function formatCurrencyVND(amount) {
    if (!amount) return '';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  }

  let vietqrModal = null;

  function openVietQRModal({ bank, accountNo, amount, accountName, note = '' }) {
    if (!vietqrModal) {
      vietqrModal = document.createElement('div');
      vietqrModal.id = 'tadaza-vietqr-overlay';
      document.body.appendChild(vietqrModal);
    }

    const template = (currentConfig.quick_parser && currentConfig.quick_parser.default_qr_template) || 'compact2';
    const params = new URLSearchParams();
    if (amount) params.append('amount', amount);
    if (accountName) params.append('accountName', accountName);
    if (note) params.append('addInfo', note);

    const bankIdentifier = bank.bin || bank.code || bank.shortName;
    const qrImageUrl = `https://img.vietqr.io/image/${bankIdentifier}-${accountNo}-${template}.png?${params.toString()}`;

    vietqrModal.innerHTML = `
      <div id="tadaza-vietqr-modal">
        <div class="tadaza-vietqr-header">
          <div class="tadaza-vietqr-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            <span>Mã VietQR Chuyển Khoản</span>
          </div>
          <button class="tadaza-close-btn" id="tadaza-vietqr-close" title="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="tadaza-vietqr-body">
          <div class="tadaza-qr-img-wrap">
            <img class="tadaza-qr-img" id="tadaza-qr-img-elem" src="${qrImageUrl}" alt="VietQR Code" />
          </div>

          <div class="tadaza-vietqr-details">
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Ngân hàng:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-bank-badge">${escapeHtml(bank.shortName)}</span>
                <span class="tadaza-detail-val">${escapeHtml(bank.name)}</span>
              </div>
            </div>

            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Số tài khoản:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val" id="val-qr-stk">${escapeHtml(accountNo)}</span>
                <button class="tadaza-copy-mini-btn" id="btn-qr-copy-stk" title="Sao chép STK">Sao chép</button>
              </div>
            </div>

            ${accountName ? `
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Chủ tài khoản:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val" style="text-transform: uppercase;">${escapeHtml(accountName)}</span>
              </div>
            </div>` : ''}

            ${amount ? `
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Số tiền:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val tadaza-parser-amount">${formatCurrencyVND(amount)}</span>
                <button class="tadaza-copy-mini-btn" id="btn-qr-copy-amount" title="Sao chép số tiền">Sao chép</button>
              </div>
            </div>` : ''}
          </div>
        </div>

        <div class="tadaza-vietqr-footer">
          <button class="tadaza-action-btn secondary" id="tadaza-vietqr-btn-close">Đóng</button>
          <div style="display: flex; gap: 8px;">
            <button class="tadaza-action-btn secondary" id="tadaza-vietqr-btn-copy-img" title="Sao chép ảnh QR">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="label-qr-copy-img">Sao chép ảnh QR</span>
            </button>
            <button class="tadaza-action-btn primary" id="tadaza-vietqr-btn-download" title="Tải ảnh QR về máy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Tải ảnh</span>
            </button>
          </div>
        </div>
      </div>
    `;

    vietqrModal.classList.add('open');

    const closeModal = () => vietqrModal.classList.remove('open');
    vietqrModal.querySelector('#tadaza-vietqr-close').addEventListener('click', closeModal);
    vietqrModal.querySelector('#tadaza-vietqr-btn-close').addEventListener('click', closeModal);
    vietqrModal.addEventListener('click', (e) => {
      if (e.target === vietqrModal) closeModal();
    });

    // Copy STK
    const copyStkBtn = vietqrModal.querySelector('#btn-qr-copy-stk');
    if (copyStkBtn) {
      copyStkBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(accountNo);
        copyStkBtn.textContent = 'Đã chép!';
        setTimeout(() => { copyStkBtn.textContent = 'Sao chép'; }, 1500);
      });
    }

    // Copy Amount
    const copyAmtBtn = vietqrModal.querySelector('#btn-qr-copy-amount');
    if (copyAmtBtn && amount) {
      copyAmtBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(amount.toString());
        copyAmtBtn.textContent = 'Đã chép!';
        setTimeout(() => { copyAmtBtn.textContent = 'Sao chép'; }, 1500);
      });
    }

    // Copy QR Image
    const copyImgBtn = vietqrModal.querySelector('#tadaza-vietqr-btn-copy-img');
    if (copyImgBtn) {
      copyImgBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(qrImageUrl);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = async () => {
            const dataUri = reader.result;
            if (bridge.copyImage) await bridge.copyImage(dataUri);
          };
          reader.readAsDataURL(blob);
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          }
          const label = vietqrModal.querySelector('#label-qr-copy-img');
          label.textContent = 'Đã chép ảnh!';
          setTimeout(() => { label.textContent = 'Sao chép ảnh QR'; }, 1500);
        } catch (err) {
          console.warn('[TADaZa] Failed to copy QR image:', err);
        }
      });
    }

    // Download QR Image
    const dlBtn = vietqrModal.querySelector('#tadaza-vietqr-btn-download');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = qrImageUrl;
        a.download = `VietQR_${bank.shortName}_${accountNo}.png`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }
  }

  function setupQuickParser() {
    let scanTimeout = null;

    const scanMessages = () => {
      const qp = currentConfig.quick_parser;
      if (!qp || !qp.enabled) return;

      const targets = document.querySelectorAll(
        '.text-message__container:not([data-tadaza-parsed]), ' +
        '[class*="bubble-content"]:not([data-tadaza-parsed]), ' +
        '[class*="msg-content"]:not([data-tadaza-parsed])'
      );

      targets.forEach(elem => {
        if (elem.closest('.tadaza-trans-box') || elem.closest('.tadaza-parser-box') || elem.closest('#tadaza-code-studio-overlay') || elem.closest('#tadaza-vietqr-overlay')) {
          return;
        }

        if (elem.querySelector('.text-message__container') || elem.querySelector('[class*="bubble-content"]')) {
          return;
        }

        elem.setAttribute('data-tadaza-parsed', '1');

        const rawText = extractMessageText(elem);
        if (!rawText || rawText.length < 5) return;

        const chatMsg = elem.closest('.chat-message, [class*="msg-item"], [class*="chat-item"]');
        const parentToAttach = elem.closest('.message-content-render')
          || (chatMsg ? chatMsg.querySelector('.message-content-render') : null)
          || elem.closest('.text-message__container')
          || elem.closest('[class*="bubble"]')
          || elem;

        // 1. Check Bank Transfer
        if (qp.auto_detect_bank) {
          const bankInfo = parseBankInfo(rawText);
          if (bankInfo) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span class="tadaza-bank-badge">${escapeHtml(bankInfo.bank.shortName)}</span>
                  <span>${escapeHtml(bankInfo.bank.name)}</span>
                </div>
                ${bankInfo.amount ? `<span class="tadaza-parser-amount">${formatCurrencyVND(bankInfo.amount)}</span>` : ''}
              </div>
              <div class="tadaza-parser-content">
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">STK:</span>
                  <span class="tadaza-parser-val">${escapeHtml(bankInfo.accountNo)}</span>
                </div>
                ${bankInfo.accountName ? `
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">Tên:</span>
                  <span class="tadaza-parser-val" style="text-transform: uppercase;">${escapeHtml(bankInfo.accountName)}</span>
                </div>` : ''}
              </div>
              <div class="tadaza-parser-actions">
                <button class="tadaza-parser-btn vietqr" title="Mở mã QR chuẩn VietQR quét chuyển tiền ngay">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <span>Tạo VietQR</span>
                </button>
                <button class="tadaza-parser-btn btn-copy-stk" title="Sao chép số tài khoản">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span class="btn-text">Chép STK</span>
                </button>
                ${bankInfo.amount ? `
                <button class="tadaza-parser-btn btn-copy-amt" title="Sao chép số tiền">
                  <span class="btn-text">Chép số tiền</span>
                </button>` : ''}
              </div>
            `;

            box.querySelector('.vietqr').addEventListener('click', (e) => {
              e.stopPropagation();
              openVietQRModal(bankInfo);
            });

            const copyStkBtn = box.querySelector('.btn-copy-stk');
            copyStkBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(bankInfo.accountNo);
              const txt = copyStkBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Chép STK'; }, 1500);
            });

            const copyAmtBtn = box.querySelector('.btn-copy-amt');
            if (copyAmtBtn && bankInfo.amount) {
              copyAmtBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await navigator.clipboard.writeText(bankInfo.amount.toString());
                const txt = copyAmtBtn.querySelector('.btn-text');
                txt.textContent = 'Đã chép!';
                setTimeout(() => { txt.textContent = 'Chép số tiền'; }, 1500);
              });
            }

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
            return;
          }
        }

        // 2. Check Tracking Code
        if (qp.auto_detect_tracking) {
          const tracking = parseTrackingInfo(rawText);
          if (tracking) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span style="font-size: 15px;">🚚</span>
                  <span>${escapeHtml(tracking.carrier)}</span>
                </div>
              </div>
              <div class="tadaza-parser-content">
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">Mã vận đơn:</span>
                  <span class="tadaza-parser-val">${escapeHtml(tracking.code)}</span>
                </div>
              </div>
              <div class="tadaza-parser-actions">
                <button class="tadaza-parser-btn btn-track" style="background:#0068ff; color:#fff; border:none;" title="Mở trang web tra cứu hành trình đơn hàng">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <span>Tra cứu đơn</span>
                </button>
                <button class="tadaza-parser-btn btn-copy-track" title="Sao chép mã vận đơn">
                  <span class="btn-text">Chép mã</span>
                </button>
              </div>
            `;

            box.querySelector('.btn-track').addEventListener('click', async (e) => {
              e.stopPropagation();
              if (bridge.openExternal) {
                await bridge.openExternal(tracking.url);
              } else {
                window.open(tracking.url, '_blank');
              }
            });

            const copyTrackBtn = box.querySelector('.btn-copy-track');
            copyTrackBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(tracking.code);
              const txt = copyTrackBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Chép mã'; }, 1500);
            });

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
            return;
          }
        }

        // 3. Check Phone Number
        if (qp.auto_detect_phone) {
          const phone = parsePhoneNumber(rawText);
          if (phone) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span style="font-size: 14px;">📞</span>
                  <span>Số điện thoại:</span>
                  <span class="tadaza-parser-val">${escapeHtml(phone)}</span>
                </div>
                <div class="tadaza-parser-actions" style="margin-top:0;">
                  <button class="tadaza-parser-btn btn-copy-phone" title="Sao chép số điện thoại">
                    <span class="btn-text">Sao chép SĐT</span>
                  </button>
                </div>
              </div>
            `;

            const copyPhoneBtn = box.querySelector('.btn-copy-phone');
            copyPhoneBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(phone);
              const txt = copyPhoneBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Sao chép SĐT'; }, 1500);
            });

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
          }
        }
      });
    };

    scanMessages();

    const observer = new MutationObserver(() => {
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanMessages, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

/* ==========================================================================
   MODULE: 06_chat_heads.js
   ========================================================================== */

/* --------------------------------------------------------------------------
     6. Floating Chat Heads (Desktop PiP) Feature
     -------------------------------------------------------------------------- */
  function getActiveConversation() {
    let name = '';

    // 1. Check document.title (e.g. "Zalo - Người nhận")
    if (document.title && document.title.includes('-')) {
      const parts = document.title.split(/[-–—]/);
      if (parts.length > 1) {
        const potentialName = parts[parts.length - 1].trim();
        if (potentialName && !['Zalo', 'Chat', 'Zalo PC', 'Zalo Web'].includes(potentialName)) {
          name = potentialName;
        }
      }
    }

    // 2. Check input placeholder (e.g. "Nhập @, tin nhắn tới...")
    if (!name) {
      const richInput = document.querySelector('[id^="richInput"]') || document.getElementById('richInput') || document.querySelector('.rich-input');
      const placeholder = (richInput ? (richInput.getAttribute('placeholder') || richInput.getAttribute('data-placeholder') || '') : '')
        || (document.querySelector('[class*="placeholder"]')?.textContent || '');
      const match = placeholder.match(/(?:tin nhắn tới|gửi tới)\s+(.+)$/i);
      if (match && match[1]) {
        name = match[1].trim();
      }
    }

    // 3. Check title elements in top header area (y: 0-70)
    if (!name) {
      const candidates = document.querySelectorAll('.header-title, [class*="header-title"], .main-title-container, .header-conv-name, .header-info__name, [class*="title-name"], .chat-box-header .title');
      for (const el of candidates) {
        const txt = el.textContent.trim();
        if (txt) {
          name = txt;
          break;
        }
      }
    }

    // 4. Check active conversation in left list
    if (!name) {
      const activeItem = document.querySelector('.conv-item.active, [class*="conv-item"][class*="active"], [class*="conv-item"][class*="selected"]');
      if (activeItem) {
        const itemTitle = activeItem.querySelector('[class*="name"], [class*="title"]');
        if (itemTitle) name = itemTitle.textContent.trim();
      }
    }

    if (!name) {
      name = 'Hội thoại'; // Default fallback
    }

    // Avatar detection: find img in top header or active sidebar item
    let avatar = '';
    const imgs = document.querySelectorAll('img');
    for (const img of imgs) {
      const rect = img.getBoundingClientRect();
      if (rect.top >= 5 && rect.top <= 80 && rect.left >= 150 && rect.left <= 450) {
        if (img.src && !img.src.includes('data:image/svg')) {
          avatar = img.src;
          break;
        }
      }
    }

    if (!avatar) {
      const activeItem = document.querySelector('.conv-item.active, [class*="conv-item"][class*="active"], [class*="conv-item"][class*="selected"]');
      if (activeItem) {
        const avaImg = activeItem.querySelector('img');
        if (avaImg && avaImg.src) avatar = avaImg.src;
      }
    }

    let safeHash = 'conv_default';
    try {
      safeHash = 'conv_' + btoa(unescape(encodeURIComponent(name))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    } catch (e) {
      safeHash = 'conv_' + name.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '');
    }

    return {
      id: safeHash,
      name,
      avatar
    };
  }

  function scrapeCurrentMessages() {
    const results = [];
    const bubbles = document.querySelectorAll(
      '.text-message__container, [class*="bubble-content"], [class*="msg-content"], .message-content'
    );

    bubbles.forEach(bubble => {
      if (bubble.closest('.tadaza-trans-box') || bubble.closest('#tadaza-code-studio-overlay')) return;
      const text = extractMessageText(bubble);
      if (!text) return;

      const chatItem = bubble.closest('.chat-message, [class*="msg-item"], [class*="chat-item"], [class*="message-item"]') || bubble;
      const classStr = (chatItem.className || '') + ' ' + (bubble.className || '');
      const isMe = /\b(me|outgoing|self|is-me|msg-me|my-message)\b/i.test(classStr)
        || Boolean(chatItem.querySelector('.avatar--right, [class*="avatar-right"]'));

      let time = '';
      const timeElem = chatItem.querySelector('[class*="message-time"], [class*="bubble-message-time"], [class*="time"]');
      if (timeElem) time = timeElem.textContent.trim();

      results.push({
        text,
        isMe,
        time
      });
    });

    return results.slice(-35);
  }

  function sendMessageToCurrentChat(text) {
    if (!text) return false;
    const richInput = document.querySelector('[id^="richInput"]') || document.getElementById('richInput') || document.querySelector('.rich-input');
    if (!richInput) return false;
    richInput.focus();

    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      richInput.innerText = text;
      richInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setTimeout(() => {
      const enterDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      richInput.dispatchEvent(enterDown);

      setTimeout(() => {
        const sendBtn = document.querySelector('.chat-input__send-btn')
          || document.querySelector('[data-translate-inner="STR_SEND"]')
          || document.querySelector('button[title*="Gửi"]')
          || document.querySelector('.btn-send');
        if (sendBtn) sendBtn.click();
      }, 60);
    }, 40);

    return true;
  }

  let pinnedChatIds = new Set();

  function setupFloatingChatHead() {
    if (!bridge) return;

    const updateButtonsUI = () => {
      const conv = getActiveConversation();
      const isPinned = conv && pinnedChatIds.has(conv.id);
      const tbBtn = document.getElementById('tadaza-btn-pin-chathead-toolbar');
      const hdBtn = document.getElementById('tadaza-btn-pin-chathead-header');
      if (tbBtn) {
        if (isPinned) tbBtn.classList.add('pinned');
        else tbBtn.classList.remove('pinned');
      }
      if (hdBtn) {
        if (isPinned) hdBtn.classList.add('pinned');
        else hdBtn.classList.remove('pinned');
      }
    };

    if (bridge.onChatHeadStateChanged) {
      bridge.onChatHeadStateChanged((state) => {
        if (state && state.pinnedChats) {
          pinnedChatIds = new Set(state.pinnedChats.map(c => c.id));
          updateButtonsUI();
        }
      });
    }

    if (bridge.onChatHeadSend) {
      bridge.onChatHeadSend(({ text }) => {
        sendMessageToCurrentChat(text);
      });
    }

    let syncTimer = null;
    const syncActiveChat = () => {
      const conv = getActiveConversation();
      if (!conv || !pinnedChatIds.has(conv.id)) return;
      const messages = scrapeCurrentMessages();
      if (bridge.syncChatHead) {
        bridge.syncChatHead({
          chatId: conv.id,
          messages
        });
      }
    };

    const syncObs = new MutationObserver(() => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(syncActiveChat, 250);
    });
    syncObs.observe(document.body, { childList: true, subtree: true });

    const togglePinAction = async () => {
      const currentConv = getActiveConversation();
      if (!currentConv) return;

      if (pinnedChatIds.has(currentConv.id)) {
        if (bridge.unpinChatHead) await bridge.unpinChatHead(currentConv.id);
        pinnedChatIds.delete(currentConv.id);
      } else {
        const messages = scrapeCurrentMessages();
        if (bridge.pinChatHead) {
          await bridge.pinChatHead({
            id: currentConv.id,
            name: currentConv.name,
            avatar: currentConv.avatar,
            messages
          });
        }
        pinnedChatIds.add(currentConv.id);
      }
      updateButtonsUI();
    };

    const mountButtons = () => {
      // Keep chat messaging interface clean - remove injected buttons
      document.querySelectorAll('#tadaza-btn-pin-chathead-toolbar, #tadaza-btn-pin-chathead-header').forEach(el => el.remove());
    };

    mountButtons();
  }

/* ==========================================================================
   MODULE: 07_profiles.js
   ========================================================================== */

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
      triggerBtn.remove();
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

    // 3. Remove any lingering floating trigger button
    const oldBtn = document.getElementById('tadaza-btn-profiles');
    if (oldBtn) oldBtn.remove();

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

    setInterval(syncProfileMeta, 5000);
  }

/* ==========================================================================
   MODULE: 08_drawer_ui.js
   ========================================================================== */

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
    const sys = currentConfig.system || {};
    const f = currentConfig.features;

    if (activeTab === 'theme') {
      const activePreset = t.active_preset || (t.hawaiian_theme ? 'hawaiian' : 'none');
      const themeOpacity = t.theme_opacity !== undefined ? t.theme_opacity : (t.hawaiian_opacity !== undefined ? t.hawaiian_opacity : 0.85);
      const themeFps = t.theme_fps || t.hawaiian_fps || 20;
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

        <div class="tadaza-section">
          <h3 class="tadaza-section-title" style="display:flex; align-items:center; gap:8px;">
            <span>Hệ sinh thái động (Ecosystem Themes)</span>
            <span style="font-size:10px; padding:2px 7px; border-radius:8px; background:linear-gradient(135deg, #10b981, #0fc3ff); color:#fff; font-weight:700;">ASCII LIVE</span>
          </h3>
          <div class="tadaza-item-desc" style="margin-bottom:8px;">
            Mô phỏng hệ sinh thái sống động theo phong cách ASCII Art & kính mờ thủy sinh học.
          </div>

          <div class="tadaza-theme-grid" id="tadaza-theme-presets-grid">
            <div class="tadaza-theme-card ${activePreset === 'hawaiian' ? 'active' : ''}" data-preset="hawaiian">
              <div class="tadaza-theme-preview hawaiian">🏝️</div>
              <div class="tadaza-theme-card-title">
                <span>Hawaiian Lagoon</span>
                <span class="tadaza-theme-card-tag">SAN HÔ</span>
              </div>
            </div>

            <div class="tadaza-theme-card ${activePreset === 'rainforest' ? 'active' : ''}" data-preset="rainforest">
              <div class="tadaza-theme-preview rainforest">🌧️</div>
              <div class="tadaza-theme-card-title">
                <span>Cơn Mưa Nhiệt Đới</span>
                <span class="tadaza-theme-card-tag">MƯA RỪNG</span>
              </div>
            </div>

            <div class="tadaza-theme-card ${activePreset === 'bioforest' ? 'active' : ''}" data-preset="bioforest">
              <div class="tadaza-theme-preview bioforest">🌿</div>
              <div class="tadaza-theme-card-title">
                <span>Rừng Ánh Sáng Đêm</span>
                <span class="tadaza-theme-card-tag">PHÁT QUANG</span>
              </div>
            </div>

            <div class="tadaza-theme-card ${activePreset === 'none' ? 'active' : ''}" data-preset="none">
              <div class="tadaza-theme-preview none">⚪</div>
              <div class="tadaza-theme-card-title">
                <span>Mặc định</span>
                <span class="tadaza-theme-card-tag">OFF</span>
              </div>
            </div>
          </div>

          ${activePreset !== 'none' ? `
            <div class="tadaza-item tadaza-item-col sub-item" style="margin-top:12px;">
              <div class="tadaza-item-info">
                <span class="tadaza-item-title">Độ rõ hình nền</span>
                <span class="tadaza-item-desc">Độ mờ / trong suốt của hoạt ảnh nền</span>
              </div>
              <div class="tadaza-range-wrap">
                <input type="range" class="tadaza-range" id="range-dynamic-theme-opacity" min="0.3" max="1" step="0.05" value="${themeOpacity}">
                <span class="tadaza-range-val">${Math.round(themeOpacity * 100)}%</span>
              </div>
            </div>

            <div class="tadaza-item sub-item">
              <div class="tadaza-item-info">
                <span class="tadaza-item-title">Tốc độ khung hình (FPS)</span>
                <span class="tadaza-item-desc">Tự động giảm còn 5 FPS khi chuyển cửa sổ để tiết kiệm pin</span>
              </div>
              <select class="tadaza-select" id="select-dynamic-theme-fps">
                <option value="15" ${themeFps === 15 ? 'selected' : ''}>15 FPS (Cực mát máy)</option>
                <option value="20" ${themeFps === 20 ? 'selected' : ''}>20 FPS (Khuyên dùng - Chuẩn)</option>
                <option value="30" ${themeFps === 30 ? 'selected' : ''}>30 FPS (Mượt mà tối đa)</option>
                <option value="10" ${themeFps === 10 ? 'selected' : ''}>10 FPS (Tiết kiệm pin)</option>
              </select>
            </div>
          ` : ''}
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

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Hệ thống & Cập nhật</h3>
          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Thu nhỏ xuống khay khi bấm nút đóng (X)</span>
              <span class="tadaza-item-desc">Mặc định tắt (bấm X để thoát hẳn Zalo). Bật để thu nhỏ xuống khay Tray.</span>
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
            <button class="tadaza-action-btn" id="btn-check-update" style="white-space:nowrap; padding:6px 12px; font-size:12px;">
              Kiểm tra ngay
            </button>
          </div>
        </div>

        <div class="tadaza-section">
          <h3 class="tadaza-section-title">Linux: Bộ gõ &amp; Hiển thị</h3>
          <div class="tadaza-item" style="display:block;">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tình trạng hệ thống</span>
              <span class="tadaza-item-desc" id="tadaza-linux-diag" style="white-space:pre-line;">Đang kiểm tra...</span>
            </div>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Chế độ hiển thị</span>
              <span class="tadaza-item-desc">X11 (XWayland): gõ tiếng Việt ổn định trên mọi môi trường. Wayland gốc: nét hơn khi scale lẻ, nhưng trên GNOME bộ gõ sẽ không hoạt động (giới hạn của Electron 22).</span>
            </div>
            <select class="tadaza-select" id="select-display-mode">
              <option value="x11" ${sys.display_mode !== 'wayland' ? 'selected' : ''}>X11 (khuyên dùng)</option>
              <option value="wayland" ${sys.display_mode === 'wayland' ? 'selected' : ''}>Wayland gốc (thử nghiệm)</option>
            </select>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Tỉ lệ hiển thị (HiDPI)</span>
              <span class="tadaza-item-desc">Dùng khi chữ bị mờ hoặc quá nhỏ ở chế độ X11 với màn hình scale lẻ.</span>
            </div>
            <select class="tadaza-select" id="select-scale-factor">
              ${[0, 1, 1.25, 1.5, 1.75, 2].map(v => `<option value="${v}" ${Number(sys.scale_factor || 0) === v ? 'selected' : ''}>${v === 0 ? 'Tự động' : Math.round(v * 100) + '%'}</option>`).join('')}
            </select>
          </div>

          <div class="tadaza-item" id="tadaza-relaunch-row" style="display:none;">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Cần khởi động lại</span>
              <span class="tadaza-item-desc">Thay đổi chế độ hiển thị / tỉ lệ có hiệu lực sau khi mở lại Zalo.</span>
            </div>
            <button class="tadaza-action-btn" id="btn-relaunch-zalo" style="white-space:nowrap; padding:6px 12px; font-size:12px;">
              Khởi động lại
            </button>
          </div>

          <div class="tadaza-item">
            <div class="tadaza-item-info">
              <span class="tadaza-item-title">Số tin chưa đọc trên Dock &amp; khay</span>
              <span class="tadaza-item-desc">Hiện số đỏ trên biểu tượng Zalo ở Ubuntu Dock / Dash to Dock / KDE Plasma và ở khay hệ thống.</span>
            </div>
            <label class="tadaza-switch">
              <input type="checkbox" id="toggle-unread-badge" ${sys.unread_badge !== false ? 'checked' : ''}>
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
        window.electronAPI.invoke('tadaza:linux-diagnostics').then(d => {
          if (!d || d.error) {
            diagEl.textContent = 'Không đọc được thông tin hệ thống' + (d && d.error ? ': ' + d.error : '');
            return;
          }
          const imName = d.inputMethod === 'fcitx' ? 'Fcitx5' : d.inputMethod === 'ibus' ? 'IBus' : null;
          const imLine = imName
            ? `${d.gtkImModuleFound === false ? '⚠️' : '✅'} Bộ gõ: ${imName} (GTK_IM_MODULE=${d.gtkImModule || 'mặc định'}${d.gtkImModuleSource === 'auto' ? ', tự cấu hình' : ''})`
            : '⚠️ Không thấy ibus/fcitx5 đang chạy — hãy cài ibus-bamboo, ibus-unikey hoặc fcitx5-unikey';
          const lines = [
            `🖥️ Phiên: ${d.session === 'wayland' ? 'Wayland' : 'X11'}${d.desktop ? ' · ' + d.desktop : ''} → Zalo đang chạy ${d.displayMode === 'wayland' ? 'Wayland gốc' : 'X11/XWayland'}`,
            imLine,
            `${d.pipewireCapture ? '✅ Chia sẻ màn hình qua PipeWire (xdg-desktop-portal)' : '✅ Chia sẻ màn hình qua X11'}`,
            `🔴 Badge: ${d.desktopFileId || '?'}${d.scaleFactor ? ' · Tỉ lệ ép ' + Math.round(d.scaleFactor * 100) + '%' : ''}`
          ].concat((d.warnings || []).map(w => '⚠️ ' + w));
          diagEl.textContent = lines.join('\n');
        }).catch(e => {
          diagEl.textContent = 'Không đọc được thông tin hệ thống: ' + e.message;
        });
      }

      const relaunchRow = drawer.querySelector('#tadaza-relaunch-row');
      const showRelaunch = () => { if (relaunchRow) relaunchRow.style.display = ''; };

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

/* ==========================================================================
   MODULE: 09_init.js
   ========================================================================== */

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

})();
