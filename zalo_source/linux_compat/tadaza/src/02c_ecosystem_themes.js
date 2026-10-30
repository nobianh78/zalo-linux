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
