/* --------------------------------------------------------------------------
   2d. ASCII Scene Engine + scenes in the Hawaiian Lagoon style
   - Hồ Sen Cá Koi (koi)   - Dải Ngân Hà (galaxy)
   - Bắc Cực (arctic)       - Mùa Xuân (spring)

   Pipeline (same as Hawaiian): vector shapes are drawn into a COLS x ROWS
   sample canvas, then every covered cell is painted as a coloured block with
   an ASCII glyph on top. Static decor is rasterised once; moving actors are
   sampled every frame inside their bounding box. Reuses hwHash / hwMix /
   hwRgb / hwLum / hwEll / hwPose from 02_hawaiian_theme.js.
   -------------------------------------------------------------------------- */

const AS_W = 1944, AS_H = 1760, AS_CW = 16, AS_CH = 22;
const AS_COLS = Math.ceil(AS_W / AS_CW), AS_ROWS = Math.ceil(AS_H / AS_CH);
const AS_TAU = Math.PI * 2;
const AS_FONT = '500 15px "Geist Mono", monospace';
const AS_RAMP = "8%XSSt%t;:";
const AS_EDGE = "',.o:;";

const asState = {
  scene: null, container: null, canvas: null, ctx: null,
  animId: null, running: false, t0: 0, last: 0, interval: 50,
  builtFor: null, ox: null, bgc: null, bgx: null, decc: null, decx: null
};
const asBuf = new Float32Array(AS_COLS * AS_ROWS * 4);
let asBBox = { minI: 0, maxI: 0, minJ: 0, maxJ: 0 };

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------
function asBgAt(sc, x, y) {
  const [dx, dy] = sc.dir || [0.45, 0.9];
  const k = Math.min(1, Math.max(0, (x * dx + y * dy) / (AS_W * dx + AS_H * dy)));
  const S = sc.stops;
  for (let i = 1; i < S.length; i++) {
    if (k <= S[i][0]) return hwMix(S[i - 1][1], S[i][1], (k - S[i - 1][0]) / (S[i][0] - S[i - 1][0]));
  }
  return S[S.length - 1][1];
}

function asRR(g, x, y, w, h, r, fill) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function asPut(g, x, y, a, s, draw) {
  g.save(); g.translate(x, y); g.rotate(a); if (s !== 1) g.scale(s, s); draw(g); g.restore();
}

function asSample(draw) {
  const ox = asState.ox;
  ox.setTransform(1, 0, 0, 1, 0, 0);
  ox.clearRect(0, 0, AS_COLS, AS_ROWS);
  ox.setTransform(AS_COLS / AS_W, 0, 0, AS_ROWS / AS_H, 0, 0);
  draw(ox);
  const d = ox.getImageData(0, 0, AS_COLS, AS_ROWS).data;
  let minI = AS_COLS, maxI = -1, minJ = AS_ROWS, maxJ = -1;
  for (let j = 0; j < AS_ROWS; j++) {
    for (let i = 0; i < AS_COLS; i++) {
      const p = (j * AS_COLS + i) * 4, al = d[p + 3];
      if (al > 10) {
        asBuf[p] = d[p]; asBuf[p + 1] = d[p + 1]; asBuf[p + 2] = d[p + 2]; asBuf[p + 3] = al / 255;
        if (i < minI) minI = i; if (i > maxI) maxI = i;
        if (j < minJ) minJ = j; if (j > maxJ) maxJ = j;
      } else {
        asBuf[p + 3] = 0;
      }
    }
  }
  asBBox = maxI >= minI ? { minI, maxI, minJ, maxJ } : { minI: 0, maxI: -1, minJ: 0, maxJ: -1 };
  return asBuf;
}

/** Paint sampled cells as coloured blocks + glyphs (the Hawaiian look). */
function asCells(ctx, sc, L, b, t, depth, flicker) {
  const sprink = sc.sprinkle || ["#ff5fa2", "#16c79a", "#8b6cff", "#ffb000"];
  for (let j = b.minJ; j <= b.maxJ; j++) {
    for (let i = b.minI; i <= b.maxI; i++) {
      const o = (j * AS_COLS + i) * 4, a = L[o + 3];
      if (a < 0.12) continue;
      const x = i * AS_CW, y = j * AS_CH;
      let c = [L[o], L[o + 1], L[o + 2]];
      if (depth) c = hwMix(c, asBgAt(sc, x, y), depth);
      const fl = flicker ? hwHash(i, j, Math.floor(t * 7)) : 0.5;
      const alpha = depth ? 0.9 : 1;
      if (a > 0.5) {
        ctx.fillStyle = hwRgb(c, alpha);
        ctx.fillRect(x + 1, y + 1, AS_CW - 2, AS_CH - 2);
        const l = hwLum(c);
        const ch = AS_RAMP[Math.max(0, Math.min(AS_RAMP.length - 1, Math.floor(1 + l * 5 + (flicker ? fl * 4 : 0))))];
        ctx.fillStyle = flicker && fl < 0.04 ? sprink[(fl * 100) | 0] : hwRgb(l < 0.42 ? hwMix(c, [255, 255, 255], 0.62) : hwMix(c, [0, 0, 0], 0.58), depth ? 0.6 : 1);
        ctx.fillText(ch, x + AS_CW / 2, y + AS_CH / 2 + 1);
      } else {
        ctx.fillStyle = hwRgb(c, Math.min(1, a * 1.6) * (depth ? 0.6 : 1));
        ctx.fillText(AS_EDGE[((flicker ? fl : hwHash(i, j, 1)) * AS_EDGE.length) | 0], x + AS_CW / 2, y + AS_CH / 2 + 1);
      }
    }
  }
}

/** Draw one glyph snapped to the cell grid. */
function asGlyph(ctx, ch, x, y, color) {
  if (x < -AS_CW || y < -AS_CH || x > AS_W || y > AS_H) return;
  ctx.fillStyle = color;
  ctx.fillText(ch, Math.floor(x / AS_CW) * AS_CW + AS_CW / 2, Math.floor(y / AS_CH) * AS_CH + AS_CH / 2 + 1);
}

// ---------------------------------------------------------------------------
// Shared ambient effects
// ---------------------------------------------------------------------------
/** Hawaiian-style moving light caustics drawn as ~ and - glyphs. */
function asCaustics(ctx, t, T, rgb, strength) {
  const w = AS_TAU / T;
  for (let j = 0; j < AS_ROWS; j += 2) {
    for (let i = 0; i < AS_COLS; i += 2) {
      const x = i * AS_CW, y = j * AS_CH;
      const v = Math.sin(x * 0.011 + y * 0.004 + w * 2 * t + 1.6 * Math.sin(y * 0.007 - w * 3 * t))
              + Math.sin(-x * 0.006 + y * 0.012 - w * 3 * t + 1.6 * Math.sin(x * 0.008 + w * 2 * t));
      if (v > 1.45) {
        const k = Math.min(1, (v - 1.45) / 1.2);
        ctx.fillStyle = `rgba(${rgb},${(0.18 + 0.4 * k) * (strength || 1)})`;
        ctx.fillText(k > 0.6 ? "~" : "-", x + AS_CW / 2, y + AS_CH / 2);
      }
    }
  }
}

/** Random twinkling glyphs (stars / sparkles). */
function asTwinkle(ctx, raw, density, chars, rgb, maxA) {
  const step = Math.floor(raw * 4);
  const ph = (raw * 4) % 1;
  for (let j = 0; j < AS_ROWS; j++) {
    for (let i = 0; i < AS_COLS; i++) {
      const h = hwHash(i, j, 7);
      if (h > density) continue;
      const tw = 0.5 + 0.5 * Math.sin(raw * (1.5 + h * 40) + h * 900);
      const blink = hwHash(i, j, step % 97) > 0.97 ? Math.sin(ph * Math.PI) : 0;
      const a = Math.min(1, (0.25 + 0.55 * tw + blink * 0.6) * (maxA || 1));
      ctx.fillStyle = `rgba(${rgb},${a})`;
      ctx.fillText(chars[(h / density * chars.length) | 0] || chars[0], i * AS_CW + AS_CW / 2, j * AS_CH + AS_CH / 2 + 1);
    }
  }
}

/** Falling particles (snow, petals). Uses raw time so motion never jumps. */
function asFall(ctx, raw, n, opt) {
  for (let k = 0; k < n; k++) {
    const h1 = hwHash(k, 1, 3), h2 = hwHash(k, 2, 5), h3 = hwHash(k, 3, 7);
    const speed = opt.speed[0] + h2 * (opt.speed[1] - opt.speed[0]);
    const y = ((h1 * (AS_H + 120) + raw * speed) % (AS_H + 120)) - 60;
    let x = h3 * AS_W + raw * (opt.drift || 0) + Math.sin(raw * (0.6 + h2) + k) * (opt.sway || 30);
    x = ((x % AS_W) + AS_W) % AS_W;
    const ch = opt.chars[(hwHash(k, 9, 1) * opt.chars.length) | 0];
    const col = opt.colors[(hwHash(k, 4, 2) * opt.colors.length) | 0];
    asGlyph(ctx, ch, x, y, col);
  }
}

/** Expanding ripple rings drawn with glyphs. */
function asRipples(ctx, raw, spots, rgb) {
  for (let k = 0; k < spots.length; k++) {
    const [cx, cy, maxR, period] = spots[k];
    const ph = ((raw / period) + hwHash(k, 5, 5)) % 1;
    const r = 10 + ph * maxR;
    const n = Math.max(10, Math.floor(r / 9));
    const a = 0.55 * (1 - ph);
    for (let q = 0; q < n; q++) {
      const ang = q / n * AS_TAU;
      asGlyph(ctx, ph < 0.5 ? "o" : "·", cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.62, `rgba(${rgb},${a})`);
    }
  }
}

/** Bubble / sparkle trail behind a moving actor path. */
function asTrail(ctx, fn, t, opt) {
  const n = opt.n || 12;
  for (let k = 1; k <= n; k++) {
    const [x, y, a] = hwPose(fn, t - k * (opt.gap || 0.09) - (opt.lag || 0.3));
    const side = (hwHash(k, opt.seed || 1, 3) - 0.5) * k * (opt.spread || 9);
    const px = x + side * -Math.sin(a), py = y + side * Math.cos(a);
    const ch = opt.chars[(hwHash(k, opt.seed || 1, Math.floor(t * 5)) * opt.chars.length) | 0];
    asGlyph(ctx, ch, px, py, `rgba(${opt.rgb},${(opt.alpha || 0.5) * (1 - k / (n + 1))})`);
  }
}

// Lissajous path helper centred on the canvas
const asLoop = (T, ax, ay, fx, fy, px, py, cx, cy) => (t) => {
  const w = AS_TAU / T;
  return [(cx || 972) + ax * Math.cos(fx * w * t + px), (cy || 880) + ay * Math.sin(fy * w * t + py)];
};

// ===========================================================================
// SCENE 1: Hồ Sen Cá Koi
// ===========================================================================
const KOI_T = 30;
const KOI_PAL = {
  kohaku: { base: "#f7f3ec", fin: "rgba(250,246,238,0.85)", spots: [[60, -10, 42, 28, "#e3462e"], [-5, 14, 32, 22, "#e3462e"], [112, 0, 18, 15, "#e3462e"]] },
  showa: { base: "#2c2a2a", fin: "rgba(70,66,66,0.9)", spots: [[45, -10, 34, 20, "#e3462e"], [-10, 12, 28, 15, "#f7f3ec"], [100, 8, 16, 12, "#f7f3ec"]] },
  ogon: { base: "#f2bf3d", fin: "rgba(255,226,140,0.9)", spots: [[30, 0, 70, 12, "#ffe08a"]] },
  chagoi: { base: "#ef8a2a", fin: "rgba(248,184,112,0.9)", spots: [[40, 0, 60, 14, "#ffc48a"]] },
  tancho: { base: "#f7f3ec", fin: "rgba(250,246,238,0.85)", spots: [[108, 0, 17, 17, "#e3462e"]] },
  sanke: { base: "#f7f3ec", fin: "rgba(250,246,238,0.85)", spots: [[55, -12, 32, 18, "#e3462e"], [0, 14, 22, 12, "#e3462e"], [80, 16, 10, 8, "#2c2a2a"], [-30, -10, 12, 8, "#2c2a2a"]] }
};

function koiFish(g, t, ph, p) {
  const b = 0.28 * Math.sin(AS_TAU * 40 * t / KOI_T + ph);
  g.save(); g.translate(-40, 0); g.rotate(b * 0.6);
  hwEll(g, -40, 0, 66, 32, 0, p.base);
  g.translate(-98, 0); g.rotate(b);
  g.beginPath(); g.moveTo(4, 0);
  g.quadraticCurveTo(-40, -16, -82, -50); g.quadraticCurveTo(-58, 0, -82, 50); g.quadraticCurveTo(-40, 16, 4, 0);
  g.fillStyle = p.fin; g.fill();
  g.restore();
  for (const m of [-1, 1]) {
    g.save(); g.translate(50, 30 * m); g.rotate(m * (0.85 + 0.3 * Math.sin(AS_TAU * 40 * t / KOI_T + ph + 1)));
    hwEll(g, 0, 26 * m, 14, 32, 0, p.fin); g.restore();
  }
  hwEll(g, 30, 0, 96, 50, 0, p.base);
  hwEll(g, 112, 0, 34, 34, 0, p.base);
  for (const [x, y, rx, ry, c] of p.spots) hwEll(g, x, y, rx, ry, 0, c);
  hwEll(g, 128, -14, 5, 5, 0, "#1b1b1b"); hwEll(g, 128, 14, 5, 5, 0, "#1b1b1b");
}

function koiLotus(g, s) {
  for (let k = 0; k < 8; k++) { g.save(); g.rotate(k * AS_TAU / 8); hwEll(g, 40 * s, 0, 40 * s, 17 * s, 0, "#f6b4cb"); g.restore(); }
  for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * AS_TAU / 6 + 0.3); hwEll(g, 24 * s, 0, 26 * s, 12 * s, 0, "#ea7aa3"); g.restore(); }
  hwEll(g, 0, 0, 14 * s, 14 * s, 0, "#ffd65e");
}

function koiPad(g, r, notch, flower) {
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, notch + 0.32, notch - 0.32 + AS_TAU); g.closePath();
  g.fillStyle = "#3e9649"; g.fill();
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.7, notch + 0.5, notch - 0.5 + AS_TAU); g.closePath();
  g.fillStyle = "#5bb75c"; g.fill();
  if (flower) { g.save(); g.translate(r * 0.15, -r * 0.1); koiLotus(g, flower); g.restore(); }
}

function koiDragonfly(g, t) {
  const f = Math.abs(Math.sin(AS_TAU * 240 * t / KOI_T));
  for (const [x, m] of [[20, -1], [20, 1], [-10, -1], [-10, 1]]) {
    g.save(); g.translate(x, 0); g.rotate(m * (x > 0 ? 1.25 : 1.85)); g.scale(1, 0.6 + 0.4 * f);
    hwEll(g, 0, 46 * m, 13, 48, 0, "rgba(214,240,255,0.75)"); g.restore();
  }
  hwEll(g, -40, 0, 70, 8, 0, "#1f6f8b");
  hwEll(g, 18, 0, 22, 13, 0, "#2a8aa8");
  hwEll(g, 44, 0, 14, 14, 0, "#145a73");
}

const KOI_PATHS = [
  asLoop(KOI_T, 1050, 600, 1, 1, 0.2, 0.2),
  asLoop(KOI_T, 760, 1000, -1, -1, 2.0, 2.0, 920, 900),
  asLoop(KOI_T, 1150, 520, 1, 2, 3.9, 4.4),
  asLoop(KOI_T, 900, 760, -2, -1, 1.2, 0.4, 1000, 860),
  asLoop(KOI_T, 1250, 820, 1, -1, 5.1, 5.1, 940, 900),
  asLoop(KOI_T, 640, 560, 2, 2, 0.9, 2.5, 1000, 820)
];
const KOI_FISH = [["kohaku", 1.5], ["showa", 1.35], ["ogon", 1.25], ["tancho", 1.4], ["sanke", 1.3], ["chagoi", 1.2]];
const KOI_PADS = [[300, 380, 140, 0.5, 0.9], [1620, 300, 120, 2.2, 0], [1720, 1360, 150, 3.4, 1.0], [460, 1440, 110, 4.6, 0], [1080, 1580, 95, 1.2, 0.7], [980, 230, 90, 5.4, 0], [180, 900, 100, 0.2, 0.8]];

const SCENE_KOI = {
  id: "koi", T: KOI_T,
  stops: [[0, [204, 240, 220]], [0.42, [118, 204, 176]], [0.78, [56, 154, 142]], [1, [30, 112, 120]]],
  grid: "rgba(255,255,255,0.06)",
  decorDepth: 0.55,
  decor(g) {
    const stone = (x, y, r, c) => hwEll(g, x, y, r, r * 0.72, hwHash(x, y, 2) * 3, c);
    for (const [x, y, r] of [[60, 120, 90], [150, 60, 60], [1880, 120, 80], [1800, 1700, 100], [1900, 1580, 70], [80, 1700, 90], [200, 1640, 60], [1000, 1730, 70]]) stone(x, y, r, hwHash(x, y, 1) > 0.5 ? "#9aa59c" : "#7f8b84");
    g.strokeStyle = "#2f7d4a"; g.lineWidth = 9; g.lineCap = "round";
    for (const [x, y] of [[700, 1650], [760, 1690], [1380, 120], [1440, 80], [80, 600], [1880, 900]]) {
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 18, y); g.quadraticCurveTo(x + k * 18 + 40, y - 120, x + k * 18 - 20, y - 220 - k * 20); g.stroke(); }
    }
  },
  light(ctx, t) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let k = 0; k < 3; k++) {
      const off = ((t / KOI_T + k / 3) % 1) * (AS_W + AS_H) * 1.2 - AS_H * 0.6;
      const gr = ctx.createLinearGradient(off, 0, off + 300, 180);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,230,0.09)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, AS_W, AS_H);
    }
    ctx.restore();
  },
  ambient(ctx, t, raw) {
    asCaustics(ctx, t, KOI_T, "255,255,255", 0.8);
    asRipples(ctx, raw, [[620, 700, 120, 5], [1300, 520, 140, 6.5], [1450, 1100, 110, 4.2], [820, 1250, 130, 5.7], [1120, 880, 100, 7.1]], "255,255,255");
  },
  actors(g, t) {
    KOI_FISH.forEach(([kind, s], k) => {
      const [x, y, a] = hwPose(KOI_PATHS[k], t);
      asPut(g, x, y, a, s, (g) => koiFish(g, t, k * 1.7, KOI_PAL[kind]));
    });
    const w = AS_TAU / KOI_T;
    const dfx = 972 + 1100 * Math.sin(w * 2 * t + 0.5), dfy = 700 + 520 * Math.sin(w * 3 * t);
    const [, , da] = hwPose((tt) => [972 + 1100 * Math.sin(w * 2 * tt + 0.5), 700 + 520 * Math.sin(w * 3 * tt)], t);
    asPut(g, dfx, dfy, da, 1.2, (g) => koiDragonfly(g, t));
    for (const [x, y, r, notch, flower] of KOI_PADS) {
      const k = hwHash(x, y, 4) * 6;
      asPut(g, x + 30 * Math.sin(w * t + k), y + 22 * Math.cos(w * t + k), 0.15 * Math.sin(w * t + k), 1, (g) => koiPad(g, r, notch, flower));
    }
  },
  shadow: "rgba(8,60,50,0.16)",
  trails(ctx, t) {
    KOI_PATHS.slice(0, 4).forEach((fn, k) => asTrail(ctx, fn, t, { chars: "~·o.", rgb: "255,255,255", seed: k + 1, n: 9, alpha: 0.45, lag: 0.45 }));
  },
  front(ctx, t, raw) {
    asFall(ctx, raw, 26, { speed: [8, 18], drift: 14, sway: 40, chars: ["*", "°", "·"], colors: ["rgba(246,170,200,0.85)", "rgba(255,214,228,0.8)", "rgba(234,122,163,0.75)"] });
  }
};

// ===========================================================================
// SCENE 2: Dải Ngân Hà
// ===========================================================================
const GX_T = 40;
const gxOsc = (t, n, ph) => Math.sin(AS_TAU * n * t / GX_T + (ph || 0));

function gxAstronaut(g, t) {
  const k = gxOsc(t, 6), k2 = gxOsc(t, 6, 1.4);
  asRR(g, -52, -60, 104, 96, 18, "#c9ccd8");                  // backpack
  g.save(); g.translate(-30, 50); g.rotate(0.2 + 0.25 * k); asRR(g, -18, 0, 36, 92, 16, "#eef0f6"); asRR(g, -20, 76, 40, 26, 10, "#9aa0b4"); g.restore();
  g.save(); g.translate(30, 50); g.rotate(-0.2 - 0.25 * k2); asRR(g, -18, 0, 36, 92, 16, "#eef0f6"); asRR(g, -20, 76, 40, 26, 10, "#9aa0b4"); g.restore();
  g.save(); g.translate(-56, -20); g.rotate(0.9 + 0.35 * k2); asRR(g, -15, 0, 30, 84, 14, "#eef0f6"); hwEll(g, 0, 88, 17, 15, 0, "#9aa0b4"); g.restore();
  g.save(); g.translate(56, -20); g.rotate(-0.9 - 0.35 * k); asRR(g, -15, 0, 30, 84, 14, "#eef0f6"); hwEll(g, 0, 88, 17, 15, 0, "#9aa0b4"); g.restore();
  asRR(g, -50, -50, 100, 116, 30, "#f6f7fb");                  // torso
  asRR(g, -26, -6, 52, 34, 8, "#d8dbe6");
  hwEll(g, -12, 10, 7, 7, 0, "#ff5d6c"); hwEll(g, 8, 10, 7, 7, 0, "#4fb6ff");
  hwEll(g, 0, -92, 62, 58, 0, "#f6f7fb");                      // helmet
  hwEll(g, 4, -90, 46, 38, 0, "#24346e");                      // visor
  hwEll(g, 18, -104, 14, 9, -0.5, "#8fc6ff");
}

function gxRocket(g, t) {
  const f = 0.75 + 0.25 * Math.abs(gxOsc(t, 120));
  hwEll(g, -150, 0, 70 * f, 26, 0, "#ff9a3c");
  hwEll(g, -132, 0, 44 * f, 15, 0, "#ffe066");
  for (const m of [-1, 1]) {
    g.beginPath(); g.moveTo(-70, 30 * m); g.lineTo(-118, 74 * m); g.lineTo(-104, 30 * m); g.closePath(); g.fillStyle = "#ff5d5d"; g.fill();
  }
  asRR(g, -110, -36, 170, 72, 30, "#f3f4f8");
  g.beginPath(); g.moveTo(56, -36); g.quadraticCurveTo(130, -30, 150, 0); g.quadraticCurveTo(130, 30, 56, 36); g.closePath(); g.fillStyle = "#ff5d5d"; g.fill();
  hwEll(g, 10, 0, 22, 22, 0, "#9aa3b8"); hwEll(g, 10, 0, 15, 15, 0, "#5fb8ff");
  asRR(g, -96, -8, 40, 16, 6, "#ff5d5d");
}

function gxUfo(g, t) {
  hwEll(g, 0, -26, 58, 46, 0, "rgba(150,240,255,0.85)");
  hwEll(g, 0, -20, 18, 22, 0, "#6fdc7a"); hwEll(g, -7, -28, 5, 6, 0, "#14301a"); hwEll(g, 7, -28, 5, 6, 0, "#14301a");
  hwEll(g, 0, 8, 150, 40, 0, "#8f95a8");
  hwEll(g, 0, 0, 140, 32, 0, "#cfd3de");
  const cols = ["#ffe066", "#ff6fa8", "#6fe0ff"];
  for (let k = 0; k < 7; k++) {
    const on = Math.sin(AS_TAU * 30 * t / GX_T + k * 1.3) > 0;
    hwEll(g, -108 + k * 36, 14, 9, 7, 0, on ? cols[k % 3] : "#6b7184");
  }
}

function gxComet(g, t) {
  for (let k = 6; k >= 1; k--) hwEll(g, -k * 46, 0, 60 + k * 6, 10 + k * 3.2, 0, k % 2 ? "rgba(159,232,255,0.55)" : "rgba(198,166,255,0.5)");
  hwEll(g, 0, 0, 34, 34, 0, "#bff3ff");
  hwEll(g, 4, 0, 22, 22, 0, "#ffffff");
}

function gxSatellite(g, t) {
  const r = gxOsc(t, 2) * 0.2;
  g.rotate(r);
  for (const m of [-1, 1]) {
    asRR(g, -36, m > 0 ? 34 : -120, 72, 86, 4, "#3d6fd8");
    g.fillStyle = "#9cc2ff"; for (let q = 1; q < 4; q++) g.fillRect(-36, (m > 0 ? 34 : -120) + q * 21, 72, 3);
  }
  asRR(g, -30, -30, 60, 60, 8, "#e8c26a");
  hwEll(g, 46, 0, 18, 26, 0, "#f3f4f8");
}

const GX_P = {
  astro: asLoop(GX_T, 520, 360, 1, 1, 0.6, 0.6, 980, 760),
  rocket: asLoop(GX_T, 1300, 760, -1, -2, 2.4, 1.1),
  ufo: asLoop(GX_T, 1050, 300, 2, 3, 4.0, 0.5, 972, 520),
  comet1: (t) => { const u = (t / GX_T * 2) % 1; return [-300 + u * (AS_W + 600), 200 + u * 900]; },
  comet2: (t) => { const u = (t / GX_T * 2 + 0.5) % 1; return [AS_W + 300 - u * (AS_W + 600), 1500 - u * 500]; },
  sat: asLoop(GX_T, 800, 600, 1, -1, 4.8, 3.3, 972, 1000)
};

const SCENE_GALAXY = {
  id: "galaxy", T: GX_T,
  dir: [0.6, 0.8],
  stops: [[0, [46, 32, 108]], [0.35, [78, 48, 152]], [0.7, [138, 66, 170]], [1, [222, 112, 156]]],
  grid: "rgba(255,255,255,0.05)",
  sprinkle: ["#ffe066", "#6fe0ff", "#ff8ad8", "#a6ff9a"],
  backdrop(g) {
    g.save(); g.globalCompositeOperation = "screen";
    for (const [x, y, r, c] of [[500, 600, 700, "rgba(90,220,255,0.18)"], [1500, 900, 800, "rgba(255,110,200,0.18)"], [1000, 300, 600, "rgba(160,120,255,0.2)"]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, AS_W, AS_H);
    }
    g.restore();
  },
  decorDepth: 0.12,
  decor(g) {
    // ringed planet
    g.save(); g.translate(1640, 1420);
    g.save(); g.beginPath(); g.arc(0, 0, 210, 0, AS_TAU); g.clip();
    const bands = ["#f6cf8f", "#e8a35c", "#f3dcae", "#d98a4b", "#f6cf8f", "#e8b070"];
    bands.forEach((c, k) => { g.fillStyle = c; g.fillRect(-220, -220 + k * 74, 440, 74); });
    g.restore();
    g.rotate(-0.32); g.lineWidth = 30; g.strokeStyle = "#f6e6bf"; g.beginPath(); g.ellipse(0, 0, 360, 80, 0, 0.05 * Math.PI, 0.95 * Math.PI); g.stroke();
    g.restore();
    // moon
    hwEll(g, 260, 280, 150, 150, 0, "#dcd6ec");
    for (const [x, y, r] of [[210, 230, 34], [310, 330, 26], [230, 360, 18], [330, 220, 20]]) hwEll(g, x, y, r, r, 0, "#b8afd0");
    // small planets
    hwEll(g, 1560, 300, 74, 74, 0, "#6fc3ff"); hwEll(g, 1560, 300, 74, 18, 0.2, "#4a9be0");
    hwEll(g, 330, 1500, 48, 48, 0, "#ff8fb1");
  },
  ambient(ctx, t, raw) {
    asTwinkle(ctx, raw, 0.03, ["·", ".", "+", "*", "·"], "255,255,255", 0.9);
  },
  actors(g, t) {
    let [x, y] = GX_P.comet1(t); asPut(g, x, y, Math.atan2(900, AS_W + 600), 1.2, (g) => gxComet(g, t));
    [x, y] = GX_P.comet2(t); asPut(g, x, y, Math.PI + Math.atan2(500, AS_W + 600), 0.9, (g) => gxComet(g, t));
    let a;
    [x, y] = GX_P.sat(t); asPut(g, x, y, 0.4, 1.1, (g) => gxSatellite(g, t));
    [x, y] = GX_P.ufo(t); asPut(g, x, y, 0.08 * gxOsc(t, 8), 1.25, (g) => gxUfo(g, t));
    [x, y, a] = hwPose(GX_P.rocket, t); asPut(g, x, y, a, 1.3, (g) => gxRocket(g, t));
    [x, y] = GX_P.astro(t); asPut(g, x, y, AS_TAU * t / GX_T, 1.25, (g) => gxAstronaut(g, t));
  },
  shadow: null,
  trails(ctx, t) {
    asTrail(ctx, GX_P.rocket, t, { chars: "*+·.", rgb: "255,190,110", seed: 3, n: 16, gap: 0.08, lag: 0.55, spread: 7, alpha: 0.75 });
    asTrail(ctx, GX_P.ufo, t, { chars: "·.", rgb: "150,240,255", seed: 5, n: 8, gap: 0.12, lag: 0.4, alpha: 0.4 });
  }
};

// ===========================================================================
// SCENE 3: Bắc Cực
// ===========================================================================
const AR_T = 36;
const arOsc = (t, n, ph) => Math.sin(AS_TAU * n * t / AR_T + (ph || 0));

function arOrca(g, t, ph) {
  const b = 0.2 * arOsc(t, 20, ph);
  g.save(); g.translate(-60, 0); g.rotate(b);
  g.beginPath(); g.moveTo(10, -48); g.quadraticCurveTo(-90, -26, -170, -10); g.lineTo(-170, 10); g.quadraticCurveTo(-90, 26, 10, 48); g.fillStyle = "#1d232a"; g.fill();
  g.translate(-170, 0); g.rotate(b * 1.4);
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-24, -70, -60, -76); g.quadraticCurveTo(-36, -22, -46, 0); g.quadraticCurveTo(-36, 22, -60, 76); g.quadraticCurveTo(-24, 70, 0, 0); g.fillStyle = "#1d232a"; g.fill();
  g.restore();
  for (const m of [-1, 1]) { g.save(); g.translate(70, 50 * m); g.rotate(m * (0.9 + 0.2 * arOsc(t, 20, ph + 1))); hwEll(g, 0, 34 * m, 18, 42, 0, "#1d232a"); g.restore(); }
  hwEll(g, 30, 0, 160, 56, 0, "#222a32");
  hwEll(g, -40, 0, 46, 30, 0, "#7f8c96");
  hwEll(g, 0, 0, 34, 9, 0, "#0f1418");
  for (const m of [-1, 1]) hwEll(g, 140, 30 * m, 30, 12, 0.3 * m, "#f4f8fa");
}

function arPenguin(g, t, ph) {
  const f = arOsc(t, 90, ph);
  for (const m of [-1, 1]) { g.save(); g.translate(8, 18 * m); g.rotate(m * (1.1 + 0.6 * f)); hwEll(g, 0, 22 * m, 8, 26, 0, "#262c35"); g.restore(); }
  hwEll(g, -36, 0, 16, 10, 0, "#262c35");
  hwEll(g, 0, 0, 52, 22, 0, "#2b323c");
  hwEll(g, 36, 0, 20, 18, 0, "#2b323c");
  hwEll(g, 40, -8, 7, 6, 0, "#f6f8fa"); hwEll(g, 40, 8, 7, 6, 0, "#f6f8fa");
  hwEll(g, 58, 0, 10, 5, 0, "#f4a23c");
}

function arBeluga(g, t) {
  const b = 0.18 * arOsc(t, 14, 2);
  g.save(); g.translate(-50, 0); g.rotate(b);
  g.beginPath(); g.moveTo(0, -36); g.quadraticCurveTo(-70, -20, -130, -8); g.lineTo(-130, 8); g.quadraticCurveTo(-70, 20, 0, 36); g.fillStyle = "#d9e6ec"; g.fill();
  g.translate(-130, 0); g.rotate(b * 1.4);
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-18, -50, -46, -56); g.quadraticCurveTo(-28, -16, -36, 0); g.quadraticCurveTo(-28, 16, -46, 56); g.quadraticCurveTo(-18, 50, 0, 0); g.fillStyle = "#c9d9e2"; g.fill();
  g.restore();
  for (const m of [-1, 1]) hwEll(g, 50, 40 * m, 30, 12, 0.6 * m, "#c9d9e2");
  hwEll(g, 20, 0, 110, 44, 0, "#e8f1f5");
  hwEll(g, 118, 0, 34, 30, 0, "#eef5f8");
}

function arBear(g, t) {
  const step = arOsc(t, 30);
  for (const [x, y, ph] of [[50, -34, 0], [50, 34, Math.PI], [-50, -36, Math.PI], [-50, 36, 0]]) {
    hwEll(g, x + 12 * (ph ? -step : step), y * 1.15, 22, 16, 0, "#e8dcc0");
  }
  hwEll(g, -64, 0, 16, 14, 0, "#efe5cc");
  hwEll(g, 0, 0, 92, 52, 0, "#f4ecd6");
  hwEll(g, 98, 0, 36, 30, 0, "#f6efdc");
  for (const m of [-1, 1]) hwEll(g, 84, 26 * m, 10, 9, 0, "#e3d6b8");
  hwEll(g, 134, 0, 9, 9, 0, "#20242a");
}

function arSeal(g, t) {
  const lift = 0.25 * arOsc(t, 6);
  for (const m of [-1, 1]) hwEll(g, -70, 18 * m, 26, 10, 0.5 * m, "#7a8792");
  hwEll(g, 0, 0, 80, 34, 0, "#8d9aa4");
  for (const [x, y] of [[-20, -10], [10, 12], [30, -14], [-40, 8]]) hwEll(g, x, y, 6, 5, 0, "#6f7d87");
  g.save(); g.translate(70, 0); g.rotate(lift);
  hwEll(g, 20, 0, 32, 28, 0, "#9aa7b0"); hwEll(g, 34, -10, 5, 5, 0, "#1b2228"); hwEll(g, 34, 10, 5, 5, 0, "#1b2228"); hwEll(g, 48, 0, 6, 5, 0, "#3a444c");
  g.restore();
  for (const m of [-1, 1]) hwEll(g, 30, 34 * m, 22, 9, 0.4 * m, "#7a8792");
}

const AR_FLOES = [[290, 330, 250, 1], [1700, 1480, 270, 2], [1660, 270, 170, 3], [190, 1480, 190, 4], [1040, 1620, 140, 5]];
const arFloe = (g, x, y, r, seed, fill) => {
  g.beginPath();
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * AS_TAU, rr = r * (0.78 + 0.32 * hwHash(seed, k, 3));
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
  }
  g.closePath(); g.fillStyle = fill; g.fill();
};

const AR_P = {
  orcaA: asLoop(AR_T, 1050, 560, 1, 1, 0.5, 0.5, 972, 860),
  orcaB: asLoop(AR_T, 1150, 640, -1, -1, 3.3, 3.3, 972, 900),
  pod: asLoop(AR_T, 900, 520, 2, 3, 1.4, 0.2, 972, 900),
  beluga: asLoop(AR_T, 1250, 380, 1, 2, 4.6, 1.0, 972, 1000)
};
const AR_POD = [[0, 0], [-170, -110], [-170, 115], [-330, 0], [-350, -210], [-340, 205]];

const SCENE_ARCTIC = {
  id: "arctic", T: AR_T,
  stops: [[0, [236, 248, 252]], [0.4, [178, 222, 240]], [0.78, [104, 174, 214]], [1, [62, 132, 190]]],
  grid: "rgba(255,255,255,0.08)",
  sprinkle: ["#5cc8ff", "#ffffff", "#a5e8ff", "#ff8fb1"],
  decorDepth: 0.06,
  decor(g) {
    for (const [x, y, r, s] of AR_FLOES) { arFloe(g, x + 10, y + 14, r * 1.04, s, "#a9cfe0"); arFloe(g, x, y, r, s, "#f7fbfd"); }
    // igloo on the first floe
    hwEll(g, 300, 330, 120, 104, 0, "#e3eef4"); hwEll(g, 300, 330, 92, 80, 0, "#f9fcfd");
    g.strokeStyle = "#c3d7e2"; g.lineWidth = 6;
    for (const r of [40, 70, 98]) { g.beginPath(); g.ellipse(300, 330, r, r * 0.86, 0, 0, AS_TAU); g.stroke(); }
    asRR(g, 380, 304, 90, 52, 22, "#e3eef4"); hwEll(g, 455, 330, 20, 20, 0, "#7f9cad");
  },
  light(ctx, t) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let k = 0; k < 3; k++) {
      const off = ((t / AR_T + k / 3) % 1) * (AS_W + AS_H) * 1.2 - AS_H * 0.6;
      const gr = ctx.createLinearGradient(off, 0, off + 260, 160);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(240,250,255,0.10)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, AS_W, AS_H);
    }
    ctx.restore();
  },
  ambient(ctx, t) { asCaustics(ctx, t, AR_T, "255,255,255", 0.9); },
  actors(g, t) {
    let [x, y, a] = hwPose(AR_P.beluga, t); asPut(g, x, y, a, 1.2, (g) => arBeluga(g, t));
    [x, y, a] = hwPose(AR_P.orcaA, t); asPut(g, x, y, a, 1.35, (g) => arOrca(g, t, 0));
    [x, y, a] = hwPose(AR_P.orcaB, t); asPut(g, x, y, a, 1.15, (g) => arOrca(g, t, 2));
    [x, y, a] = hwPose(AR_P.pod, t);
    const ca = Math.cos(a), sa = Math.sin(a);
    AR_POD.forEach(([px, py], k) => {
      const wob = 10 * arOsc(t, 9, k);
      asPut(g, x + px * ca - (py + wob) * sa, y + px * sa + (py + wob) * ca, a + 0.12 * arOsc(t, 11, k), 1.35, (g) => arPenguin(g, t, k));
    });
    // bear walks around the big floe, seal rests on another
    const ba = AS_TAU * 2 * t / AR_T;
    asPut(g, 1700 + 150 * Math.cos(ba), 1480 + 110 * Math.sin(ba), ba + Math.PI / 2, 1.15, (g) => arBear(g, t));
    asPut(g, 210, 1480, -0.3, 1.2, (g) => arSeal(g, t));
    asPut(g, 1660, 280, 2.6, 0.9, (g) => arSeal(g, t + 7));
  },
  shadow: "rgba(30,80,110,0.16)",
  trails(ctx, t) {
    asTrail(ctx, AR_P.orcaA, t, { chars: ".·o°", rgb: "255,255,255", seed: 1, lag: 0.5 });
    asTrail(ctx, AR_P.orcaB, t, { chars: ".·o°", rgb: "255,255,255", seed: 2, lag: 0.45 });
    asTrail(ctx, AR_P.pod, t, { chars: ".·o", rgb: "255,255,255", seed: 3, lag: 0.35, n: 10 });
  },
  front(ctx, t, raw) {
    asFall(ctx, raw, 150, { speed: [40, 90], drift: -18, sway: 26, chars: ["*", "·", "+", "."], colors: ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.7)", "rgba(230,246,255,0.8)"] });
  }
};

// ===========================================================================
// SCENE 4: Mùa Xuân
// ===========================================================================
const SP_T = 32;
const spOsc = (t, n, ph) => Math.sin(AS_TAU * n * t / SP_T + (ph || 0));

function spBlossom(g, s, c1, c2) {
  for (let k = 0; k < 5; k++) { g.save(); g.rotate(k * AS_TAU / 5); hwEll(g, 30 * s, 0, 30 * s, 22 * s, 0, c1); g.restore(); }
  hwEll(g, 0, 0, 13 * s, 13 * s, 0, c2);
}

function spSwallow(g, t, ph) {
  const f = spOsc(t, 70, ph);
  g.beginPath(); g.moveTo(-40, -6); g.lineTo(-110, -34); g.lineTo(-62, 0); g.lineTo(-110, 34); g.lineTo(-40, 6); g.closePath(); g.fillStyle = "#22304f"; g.fill();
  for (const m of [-1, 1]) {
    g.save(); g.scale(1, 0.35 + 0.65 * Math.abs(f));
    g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(-10, 90 * m, -70, 150 * m); g.quadraticCurveTo(-20, 70 * m, -30, 0); g.closePath(); g.fillStyle = "#2a3a60"; g.fill();
    g.restore();
  }
  hwEll(g, 0, 0, 52, 18, 0, "#22304f");
  hwEll(g, 8, 6, 34, 10, 0, "#f3efe9");
  hwEll(g, 44, 0, 16, 14, 0, "#b53a2e");
}

function spKite(g, t, c1, c2) {
  g.beginPath(); g.moveTo(90, 0); g.lineTo(0, -64); g.lineTo(-120, 0); g.lineTo(0, 64); g.closePath(); g.fillStyle = c1; g.fill();
  g.beginPath(); g.moveTo(90, 0); g.lineTo(0, -64); g.lineTo(0, 64); g.closePath(); g.fillStyle = c2; g.fill();
  g.strokeStyle = "#6b3f2a"; g.lineWidth = 5; g.beginPath(); g.moveTo(90, 0); g.lineTo(-120, 0); g.moveTo(0, -64); g.lineTo(0, 64); g.stroke();
}

function spButterfly(g, t, ph, c1, c2) {
  const f = 0.3 + 0.7 * Math.abs(spOsc(t, 110, ph));
  for (const m of [-1, 1]) {
    g.save(); g.scale(1, f);
    hwEll(g, 14, 30 * m, 26, 34, 0.3 * m, c1); hwEll(g, -18, 26 * m, 20, 24, -0.3 * m, c2);
    g.restore();
  }
  hwEll(g, 0, 0, 34, 6, 0, "#3b2a24");
}

function spLantern(g) {
  g.fillStyle = "#6b3f2a"; g.fillRect(-2, -120, 4, 120);
  asRR(g, -26, -8, 52, 16, 5, "#f2c14e");
  hwEll(g, 0, 50, 56, 52, 0, "#e33b2e");
  hwEll(g, -18, 50, 14, 46, 0, "#f05a45");
  asRR(g, -26, 92, 52, 16, 5, "#f2c14e");
  for (let k = -2; k <= 2; k++) { g.fillStyle = "#f2c14e"; g.fillRect(k * 6 - 2, 108, 4, 40); }
}

const SP_P = {
  flock: asLoop(SP_T, 1150, 420, 1, 2, 0.4, 0.9, 972, 760),
  kiteA: asLoop(SP_T, 420, 160, 1, 2, 0.0, 0.0, 1100, 520),
  kiteB: asLoop(SP_T, 360, 140, -1, -2, 2.0, 1.0, 700, 980),
  bf1: asLoop(SP_T, 600, 300, 3, 2, 0.3, 0.9, 900, 1250),
  bf2: asLoop(SP_T, 520, 360, -2, 3, 2.1, 1.5, 1300, 1100),
  bf3: asLoop(SP_T, 700, 240, 2, -3, 4.2, 0.6, 700, 600)
};
const SP_FLOCK = [[0, 0], [-120, -80], [-120, 90], [-240, -160], [-240, 170], [-360, -60], [-360, 70]];
const SP_FLOWERS = [[0.05, 300, 1.2], [0.3, 1100, 1.0], [0.55, 640, 1.3], [0.78, 1400, 0.9]];

const SCENE_SPRING = {
  id: "spring", T: SP_T,
  dir: [0.3, 1],
  stops: [[0, [255, 242, 230]], [0.4, [255, 216, 216]], [0.75, [247, 182, 204]], [1, [222, 152, 198]]],
  grid: "rgba(255,255,255,0.10)",
  sprinkle: ["#ff5f8f", "#ffb000", "#ffffff", "#e33b2e"],
  backdrop(g) {
    const gr = g.createRadialGradient(1640, 260, 0, 1640, 260, 420);
    gr.addColorStop(0, "rgba(255,236,170,0.85)"); gr.addColorStop(0.45, "rgba(255,214,150,0.35)"); gr.addColorStop(1, "rgba(255,214,150,0)");
    g.fillStyle = gr; g.fillRect(0, 0, AS_W, AS_H);
  },
  decorDepth: 0.14,
  decor(g) {
    // distant hills
    g.fillStyle = "#e2a8c4";
    g.beginPath(); g.moveTo(0, AS_H); for (let x = 0; x <= AS_W; x += 60) g.lineTo(x, 1560 - 90 * Math.sin(x * 0.004) - 50 * Math.sin(x * 0.011 + 1)); g.lineTo(AS_W, AS_H); g.closePath(); g.fill();
    g.fillStyle = "#d48fb3";
    g.beginPath(); g.moveTo(0, AS_H); for (let x = 0; x <= AS_W; x += 60) g.lineTo(x, 1660 - 60 * Math.sin(x * 0.006 + 2)); g.lineTo(AS_W, AS_H); g.closePath(); g.fill();
    // peach branches
    g.strokeStyle = "#6b3f2a"; g.lineCap = "round";
    const branch = (pts, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); g.stroke(); };
    branch([-40, 120, 300, 80, 640, 260], 30); branch([300, 110, 380, 0, 520, -20], 18); branch([460, 200, 560, 320, 760, 330], 16);
    branch([AS_W + 40, 1180, 1700, 1180, 1380, 1340], 30); branch([1680, 1190, 1620, 1060, 1520, 1000], 16);
    for (const [x, y, s] of [[620, 250, 1.3], [520, 180, 1.0], [760, 330, 1.2], [700, 260, 0.9], [420, 70, 1.1], [520, -10, 1.0], [250, 120, 1.0], [360, 170, 0.8], [1400, 1330, 1.3], [1520, 1290, 1.0], [1520, 1000, 1.1], [1610, 1070, 0.9], [1760, 1200, 1.2], [1860, 1150, 1.0]]) {
      g.save(); g.translate(x, y); g.rotate(hwHash(x, y, 1) * AS_TAU); spBlossom(g, s, hwHash(x, y, 2) > 0.5 ? "#f7a6c1" : "#fbc4d6", "#d94f7c"); g.restore();
    }
  },
  light(ctx, t) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let k = 0; k < 3; k++) {
      const off = ((t / SP_T + k / 3) % 1) * (AS_W + AS_H) * 1.2 - AS_H * 0.6;
      const gr = ctx.createLinearGradient(off, 0, off + 300, 200);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,240,210,0.10)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, AS_W, AS_H);
    }
    ctx.restore();
  },
  ambient(ctx, t, raw) { asTwinkle(ctx, raw, 0.004, ["+", "*", "·"], "255,255,255", 0.8); },
  actors(g, t) {
    // lanterns hanging from the top branch
    for (const [x, y, ph] of [[560, 240, 0], [700, 300, 1.4]]) asPut(g, x, y, 0.12 * spOsc(t, 6, ph), 1, (g) => { g.translate(0, 120); spLantern(g); });
    // kites with ribbon tails
    for (const [fn, c1, c2, s] of [[SP_P.kiteA, "#e84a4a", "#ffd23f", 1.25], [SP_P.kiteB, "#3a8dde", "#ffffff", 1.05]]) {
      const [x, y] = fn(t);
      asPut(g, x, y, -0.5 + 0.15 * spOsc(t, 5), s, (g) => spKite(g, t, c1, c2));
      for (let k = 1; k <= 6; k++) {
        const [tx, ty] = fn(t - k * 0.12);
        asPut(g, tx - 110 * s - k * 22, ty + 70 + k * 26, spOsc(t, 10, k) * 0.6, 1, (g) => { hwEll(g, -10, 0, 16, 8, 0.6, c1); hwEll(g, 10, 0, 16, 8, -0.6, c2); });
      }
    }
    // swallow flock
    let [x, y, a] = hwPose(SP_P.flock, t);
    const ca = Math.cos(a), sa = Math.sin(a);
    SP_FLOCK.forEach(([px, py], k) => {
      const wob = 16 * spOsc(t, 7, k);
      asPut(g, x + px * ca - (py + wob) * sa, y + px * sa + (py + wob) * ca, a + 0.12 * spOsc(t, 9, k), 0.95, (g) => spSwallow(g, t, k));
    });
    // butterflies
    [x, y, a] = hwPose(SP_P.bf1, t); asPut(g, x, y, a, 1.1, (g) => spButterfly(g, t, 0, "#ff9b3d", "#ffd23f"));
    [x, y, a] = hwPose(SP_P.bf2, t); asPut(g, x, y, a, 1.0, (g) => spButterfly(g, t, 1, "#4aa3ff", "#a7d8ff"));
    [x, y, a] = hwPose(SP_P.bf3, t); asPut(g, x, y, a, 0.9, (g) => spButterfly(g, t, 2, "#ff6fa8", "#ffd1e3"));
    // big drifting blossoms
    for (const [p0, y0, s] of SP_FLOWERS) {
      const u = (p0 + t / SP_T) % 1;
      asPut(g, -200 + u * (AS_W + 400), y0 + u * 360 + 30 * spOsc(t, 3, p0 * 9), AS_TAU * 2 * t / SP_T + p0 * 6, s * 1.6, (g) => spBlossom(g, 1, "#f48fb1", "#c2185b"));
    }
  },
  shadow: "rgba(150,70,100,0.12)",
  trails(ctx, t) {
    asTrail(ctx, SP_P.kiteA, t, { chars: "·*", rgb: "255,255,255", seed: 4, n: 8, lag: 0.3, alpha: 0.5 });
  },
  front(ctx, t, raw) {
    asFall(ctx, raw, 120, { speed: [30, 70], drift: 26, sway: 50, chars: ["*", "°", "·", ","], colors: ["rgba(240,98,146,0.85)", "rgba(248,187,208,0.9)", "rgba(255,255,255,0.8)", "rgba(236,64,122,0.7)"] });
  }
};

const AS_SCENES = { koi: SCENE_KOI, galaxy: SCENE_GALAXY, arctic: SCENE_ARCTIC, spring: SCENE_SPRING };
const AS_LEGACY = { rainforest: "koi", bioforest: "galaxy" };

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
function asBuildStatics(sc) {
  if (asState.builtFor === sc.id) return;
  const mk = (w, h, read) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d", read ? { willReadFrequently: true } : undefined)]; };
  if (!asState.ox) {
    [, asState.ox] = mk(AS_COLS, AS_ROWS, true);
    [asState.bgc, asState.bgx] = mk(AS_W, AS_H);
    [asState.decc, asState.decx] = mk(AS_W, AS_H);
  }
  const bg = asState.bgx, [dx, dy] = sc.dir || [0.45, 0.9];
  const gr = bg.createLinearGradient(0, 0, AS_W * dx, AS_H * dy);
  sc.stops.forEach(([k, c]) => gr.addColorStop(k, hwRgb(c)));
  bg.globalCompositeOperation = "source-over";
  bg.fillStyle = gr; bg.fillRect(0, 0, AS_W, AS_H);
  if (sc.backdrop) sc.backdrop(bg);
  bg.fillStyle = sc.grid || "rgba(255,255,255,0.07)";
  for (let x = 0; x < AS_W; x += AS_CW) bg.fillRect(x, 0, 1, AS_H);
  for (let y = 0; y < AS_H; y += AS_CH) bg.fillRect(0, y, AS_W, 1);

  const dec = asState.decx;
  dec.clearRect(0, 0, AS_W, AS_H);
  if (sc.decor) {
    const buf = asSample((g) => sc.decor(g));
    dec.font = AS_FONT; dec.textAlign = "center"; dec.textBaseline = "middle";
    asCells(dec, sc, buf, { minI: 0, maxI: AS_COLS - 1, minJ: 0, maxJ: AS_ROWS - 1 }, 0, sc.decorDepth || 0, false);
  }
  asState.builtFor = sc.id;
}

function asDraw(raw) {
  const sc = asState.scene, ctx = asState.ctx;
  if (!sc || !ctx) return;
  const t = ((raw % sc.T) + sc.T) % sc.T;
  ctx.drawImage(asState.bgc, 0, 0);
  ctx.drawImage(asState.decc, 0, 0);
  if (sc.light) sc.light(ctx, t);
  ctx.font = AS_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (sc.ambient) sc.ambient(ctx, t, raw);

  const buf = asSample((g) => sc.actors(g, t));
  const b = asBBox;
  if (sc.shadow) {
    ctx.fillStyle = sc.shadow;
    for (let j = b.minJ; j <= b.maxJ && j < AS_ROWS - 2; j++) {
      for (let i = b.minI; i <= b.maxI && i < AS_COLS - 2; i++) {
        if (buf[(j * AS_COLS + i) * 4 + 3] > 0.3) ctx.fillRect((i + 2) * AS_CW, (j + 2) * AS_CH, AS_CW, AS_CH);
      }
    }
  }
  if (sc.trails) sc.trails(ctx, t);
  asCells(ctx, sc, buf, b, t, 0, true);
  if (sc.front) sc.front(ctx, t, raw);
}

function asResize() {
  if (!asState.canvas) return;
  const s = Math.max(window.innerWidth / AS_W, window.innerHeight / AS_H);
  asState.canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
}

function asLoopFrame(now) {
  if (!asState.running) return;
  asState.animId = requestAnimationFrame(asLoopFrame);
  const focused = typeof document.hasFocus === "function" ? document.hasFocus() : true;
  const interval = focused ? asState.interval : Math.max(asState.interval, 200);
  const elapsed = now - asState.last;
  if (elapsed >= interval) {
    asState.last = now - (elapsed % interval);
    asDraw((now - asState.t0) / 1000);
  }
}

function asStop() {
  if (asState.animId) cancelAnimationFrame(asState.animId);
  asState.animId = null;
  asState.running = false;
  if (asState.scene) document.body.classList.remove(`tadaza-scene-${asState.scene.id}`);
  asState.scene = null;
  if (!document.body.classList.contains("tadaza-scene-hawaiian")) document.body.classList.remove("tadaza-ascii-scene");
  if (asState.container) asState.container.style.display = "none";
}

function asStart(id, opacity, fps) {
  const sc = AS_SCENES[id];
  if (!sc) return asStop();
  if (asState.scene && asState.scene.id !== id) document.body.classList.remove(`tadaza-scene-${asState.scene.id}`);
  asState.scene = sc;
  document.body.classList.add("tadaza-ascii-scene", `tadaza-scene-${id}`);

  if (!asState.container) {
    const box = document.createElement("div");
    box.id = "tadaza-ascii-container";
    const cv = document.createElement("canvas");
    cv.id = "tadaza-ascii-canvas";
    cv.width = AS_W; cv.height = AS_H;
    box.appendChild(cv);
    document.body.prepend(box);
    asState.container = box; asState.canvas = cv; asState.ctx = cv.getContext("2d");
    window.addEventListener("resize", asResize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (asState.animId) cancelAnimationFrame(asState.animId);
        asState.animId = null;
      } else if (asState.running && !asState.animId) {
        asState.last = performance.now();
        asState.animId = requestAnimationFrame(asLoopFrame);
      }
    });
  }
  asBuildStatics(sc);
  asState.container.style.display = "block";
  asState.container.style.opacity = opacity !== undefined ? opacity : 0.85;
  asResize();
  asState.interval = 1000 / Math.min(fps || 20, 30);
  asState.running = true;
  if (!asState.animId) {
    asState.t0 = performance.now();
    asState.last = asState.t0;
    asState.animId = requestAnimationFrame(asLoopFrame);
  }
}

// ---------------------------------------------------------------------------
// Global dispatcher used by applyTheme(): picks Hawaiian or an ASCII scene
// ---------------------------------------------------------------------------
function updateDynamicThemes(themeCfg) {
  if (!themeCfg) return;
  let active = themeCfg.active_preset || (themeCfg.hawaiian_theme ? "hawaiian" : "none");
  if (AS_LEGACY[active]) active = AS_LEGACY[active];

  const opacity = themeCfg.theme_opacity !== undefined ? themeCfg.theme_opacity : (themeCfg.hawaiian_opacity !== undefined ? themeCfg.hawaiian_opacity : 0.85);
  const fps = themeCfg.theme_fps || themeCfg.hawaiian_fps || 20;

  if (active === "hawaiian") {
    asStop();
    if (typeof updateHawaiianTheme === "function") updateHawaiianTheme({ ...themeCfg, hawaiian_theme: true, hawaiian_opacity: opacity, hawaiian_fps: fps });
  } else {
    if (typeof updateHawaiianTheme === "function") updateHawaiianTheme({ ...themeCfg, hawaiian_theme: false });
    if (AS_SCENES[active]) asStart(active, opacity, fps);
    else asStop();
  }
}
