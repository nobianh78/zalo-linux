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

    // 1. Insert button into bottom chat toolbar (next to Code button <>)
    const insertToolbarButton = () => {
      if (document.getElementById('tadaza-btn-pin-chathead-toolbar')) return;

      const bar = document.querySelector('.chat-box-toolbar')
        || document.querySelector('.chat-box-input__tools')
        || document.querySelector('.chat-box-bar')
        || document.querySelector('.chat-input-btns')
        || document.querySelector('#chat-box-bar-id')
        || document.querySelector('.chat-input-container__left-layout')
        || document.querySelector('.chat-input-container');

      if (!bar) return;

      const conv = getActiveConversation();
      const isPinned = conv && pinnedChatIds.has(conv.id);

      const btn = document.createElement('div');
      btn.id = 'tadaza-btn-pin-chathead-toolbar';
      btn.className = `tadaza-chat-tool-btn ${isPinned ? 'pinned' : ''}`;
      btn.title = 'Ghim ra Bong bóng chat rời (Chat Head Desktop PiP)';
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          <circle cx="12" cy="12" r="2.5" fill="#89b4fa" stroke="none"></circle>
        </svg>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePinAction();
      });

      const codeBtn = document.getElementById('tadaza-btn-code-studio');
      if (codeBtn && codeBtn.nextSibling) {
        bar.insertBefore(btn, codeBtn.nextSibling);
      } else {
        bar.appendChild(btn);
      }
    };

    // 2. Insert button into top header (next to phone/video/search icons)
    const insertHeaderButton = () => {
      if (document.getElementById('tadaza-btn-pin-chathead-header')) return;

      let headerContainer = null;
      let refNode = null;

      const allSvgs = document.querySelectorAll('svg');
      for (const svg of allSvgs) {
        const rect = svg.getBoundingClientRect();
        if (rect.top >= 0 && rect.top <= 75 && rect.right > 450) {
          const btnWrapper = svg.closest('[role="button"], button, [class*="btn"], div[tabindex]');
          if (btnWrapper && btnWrapper.parentElement) {
            headerContainer = btnWrapper.parentElement;
            refNode = btnWrapper;
            break;
          }
        }
      }

      if (!headerContainer) {
        headerContainer = document.querySelector(
          '.chat-box-header .action-bar, [class*="header-actions"], [class*="header-tool"], [class*="header-btns"], [class*="chat-header__tools"], .chat-box-header'
        );
      }

      if (!headerContainer) return;

      const conv = getActiveConversation();
      const isPinned = conv && pinnedChatIds.has(conv.id);

      const btn = document.createElement('div');
      btn.id = 'tadaza-btn-pin-chathead-header';
      btn.className = `tadaza-chat-header-btn ${isPinned ? 'pinned' : ''}`;
      btn.title = 'Ghim ra Bong bóng chat rời (Chat Head Desktop PiP)';
      btn.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          <circle cx="12" cy="12" r="3" fill="#89b4fa" stroke="none"></circle>
        </svg>
      `;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePinAction();
      });

      if (refNode) {
        headerContainer.insertBefore(btn, refNode);
      } else {
        headerContainer.appendChild(btn);
      }
    };

    const mountButtons = () => {
      insertToolbarButton();
      insertHeaderButton();
    };

    mountButtons();
    const pinObs = new MutationObserver(mountButtons);
    pinObs.observe(document.body, { childList: true, subtree: true });
  }
