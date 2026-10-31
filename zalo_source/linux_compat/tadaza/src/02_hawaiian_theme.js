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
    document.body.classList.remove('tadaza-theme-hawaiian', 'tadaza-scene-hawaiian');
    if (!document.body.className.match(/tadaza-scene-(?!hawaiian)/)) document.body.classList.remove('tadaza-ascii-scene');
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
  document.body.classList.add('tadaza-theme-hawaiian', 'tadaza-ascii-scene', 'tadaza-scene-hawaiian');
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


