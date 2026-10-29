const fs = require('fs');
const path = require('path');
const vm = require('vm');

function buildTadaza() {
  const baseDir = __dirname;
  const cssDir = path.join(baseDir, 'css');
  const srcDir = path.join(baseDir, 'src');
  const outCss = path.join(baseDir, 'tadaza_theme.css');
  const outJs = path.join(baseDir, 'tadaza_renderer.js');

  // 1. Build CSS
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).sort();
    let combinedCss = '/* Auto-generated bundle from linux_compat/tadaza/css - Do not edit directly */\n\n';
    for (const file of cssFiles) {
      const content = fs.readFileSync(path.join(cssDir, file), 'utf8');
      combinedCss += `/* ==========================================================================\n   MODULE: ${file}\n   ========================================================================== */\n\n`;
      combinedCss += content.trim() + '\n\n';
    }
    fs.writeFileSync(outCss, combinedCss, 'utf8');
    console.log(`[TADaZa Builder] Compiled ${cssFiles.length} CSS files -> tadaza_theme.css (${combinedCss.length} bytes)`);
  }

  // 2. Build JS
  if (fs.existsSync(srcDir)) {
    const jsFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
    let combinedJs = '/* Auto-generated bundle from linux_compat/tadaza/src - Do not edit directly */\n\n';
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      combinedJs += `/* ==========================================================================\n   MODULE: ${file}\n   ========================================================================== */\n\n`;
      combinedJs += content.trim() + '\n\n';
    }

    // Validate JS syntax before writing
    try {
      new vm.Script(combinedJs);
    } catch (err) {
      console.error('[TADaZa Builder] Syntax validation failed:', err.message);
      throw err;
    }

    fs.writeFileSync(outJs, combinedJs, 'utf8');
    console.log(`[TADaZa Builder] Compiled ${jsFiles.length} JS modules -> tadaza_renderer.js (${combinedJs.length} bytes)`);
  }
}

if (require.main === module) {
  buildTadaza();
}

module.exports = { buildTadaza };
