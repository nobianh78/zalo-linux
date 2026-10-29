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
