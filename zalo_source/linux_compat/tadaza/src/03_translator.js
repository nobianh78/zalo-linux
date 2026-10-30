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
