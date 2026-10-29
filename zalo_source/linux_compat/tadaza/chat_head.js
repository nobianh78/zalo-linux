(function () {
  const bridge = window.chatHeadBridge;
  if (!bridge) {
    console.error('[ChatHead] Bridge not found');
    return;
  }

  const container = document.getElementById('chathead-container');
  const bubbleView = document.getElementById('bubble-view');
  const bubbleAvatarImg = document.getElementById('bubble-avatar-img');
  const bubbleDefaultIcon = document.getElementById('bubble-default-icon');
  const bubbleBadge = document.getElementById('bubble-badge');
  const bubbleCloseBtn = document.getElementById('bubble-close-btn');

  const expandedView = document.getElementById('expanded-view');
  const pipTabsBar = document.getElementById('pip-tabs-bar');
  const pipHeader = document.getElementById('pip-header');
  const pipAvatar = document.getElementById('pip-avatar');
  const pipName = document.getElementById('pip-name');
  const pipBody = document.getElementById('pip-body');
  const pipEmptyState = document.getElementById('pip-empty-state');
  const pipInput = document.getElementById('pip-input');
  const pipSendBtn = document.getElementById('pip-send-btn');
  const pipBtnMinimize = document.getElementById('pip-btn-minimize');
  const pipBtnFocusMain = document.getElementById('pip-btn-focus-main');
  const pipBtnClose = document.getElementById('pip-btn-close');

  let state = {
    pinnedChats: [],
    activeChatId: null,
    mode: 'bubble'
  };

  // --------------------------------------------------------------------------
  // Drag Handling for Linux/Electron Frameless Window
  // --------------------------------------------------------------------------
  function setupDrag(element) {
    let isDragging = false;
    let startScreenX = 0;
    let startScreenY = 0;
    let totalMoved = 0;

    element.addEventListener('mousedown', (e) => {
      // Ignore click on buttons inside the drag element
      if (e.target.closest('button') || e.target.closest('.bubble-close-btn') || e.target.closest('.pip-tab-item')) {
        return;
      }
      isDragging = true;
      startScreenX = e.screenX;
      startScreenY = e.screenY;
      totalMoved = 0;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.screenX - startScreenX;
      const deltaY = e.screenY - startScreenY;
      totalMoved += Math.abs(deltaX) + Math.abs(deltaY);

      if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        bridge.moveWindow({ deltaX, deltaY });
        startScreenX = e.screenX;
        startScreenY = e.screenY;
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    return () => totalMoved;
  }

  const getBubbleMoved = setupDrag(bubbleView);
  setupDrag(pipHeader);

  // Click on bubble to expand
  bubbleView.addEventListener('click', (e) => {
    if (e.target.closest('.bubble-close-btn')) return;
    if (getBubbleMoved() > 6) return; // It was a drag, not a click
    bridge.setMode('expanded');
  });

  // Minimize to bubble
  pipBtnMinimize.addEventListener('click', () => {
    bridge.setMode('bubble');
  });

  // Jump to Main Zalo Window
  pipBtnFocusMain.addEventListener('click', () => {
    bridge.focusMain();
  });

  // Close / Unpin
  const handleClose = () => {
    if (state.activeChatId) {
      bridge.unpinChat(state.activeChatId);
    } else {
      bridge.closeWindow();
    }
  };
  bubbleCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleClose();
  });
  pipBtnClose.addEventListener('click', handleClose);

  // --------------------------------------------------------------------------
  // Message Sending
  // --------------------------------------------------------------------------
  function sendMessage() {
    const text = (pipInput.value || '').trim();
    if (!text || !state.activeChatId) return;

    // Send through IPC to main window
    bridge.sendMessage({
      text,
      chatId: state.activeChatId
    });

    // Optimistically render outgoing message
    appendMessage({
      isMe: true,
      text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    });

    pipInput.value = '';
    pipInput.focus();
  }

  pipSendBtn.addEventListener('click', sendMessage);
  pipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // --------------------------------------------------------------------------
  // UI Rendering & Data Synchronization
  // --------------------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function appendMessage(msg) {
    if (pipEmptyState) {
      pipEmptyState.style.display = 'none';
    }

    const row = document.createElement('div');
    row.className = `msg-row ${msg.isMe ? 'out' : 'in'}`;

    let html = '';
    if (msg.sender && !msg.isMe) {
      html += `<div style="font-size:11px; color:#89b4fa; margin-bottom:2px; font-weight:600;">${escapeHtml(msg.sender)}</div>`;
    }
    html += `<div class="msg-bubble">${escapeHtml(msg.text)}</div>`;
    if (msg.time) {
      html += `<div class="msg-time">${escapeHtml(msg.time)}</div>`;
    }

    row.innerHTML = html;
    pipBody.appendChild(row);
    pipBody.scrollTop = pipBody.scrollHeight;
  }

  function renderMessages(messages) {
    pipBody.innerHTML = '';
    if (!messages || messages.length === 0) {
      pipBody.appendChild(pipEmptyState);
      pipEmptyState.style.display = 'block';
      return;
    }

    pipEmptyState.style.display = 'none';
    messages.forEach(msg => appendMessage(msg));
  }

  function renderTabs() {
    if (!state.pinnedChats || state.pinnedChats.length <= 1) {
      pipTabsBar.className = 'pip-tabs-bar';
      pipTabsBar.innerHTML = '';
      return;
    }

    pipTabsBar.className = 'pip-tabs-bar visible';
    pipTabsBar.innerHTML = state.pinnedChats.map(c => `
      <div class="pip-tab-item ${c.id === state.activeChatId ? 'active' : ''}" data-chat-id="${escapeHtml(c.id)}">
        <span>${escapeHtml(c.name || 'Chat')}</span>
      </div>
    `).join('');

    pipTabsBar.querySelectorAll('.pip-tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        const id = tab.getAttribute('data-chat-id');
        if (id && id !== state.activeChatId) {
          bridge.switchChat(id);
        }
      });
    });
  }

  function updateActiveChatUI() {
    const activeChat = state.pinnedChats.find(c => c.id === state.activeChatId) || state.pinnedChats[0];
    if (!activeChat) return;

    // Update Bubble
    if (activeChat.avatar) {
      bubbleAvatarImg.src = activeChat.avatar;
      bubbleAvatarImg.style.display = 'block';
      bubbleDefaultIcon.style.display = 'none';
    } else {
      bubbleAvatarImg.style.display = 'none';
      bubbleDefaultIcon.style.display = 'flex';
    }

    // Total unread across all pinned chats
    const totalUnread = state.pinnedChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    if (totalUnread > 0) {
      bubbleBadge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
      bubbleBadge.classList.add('has-unread');
    } else {
      bubbleBadge.classList.remove('has-unread');
    }

    // Update Expanded Header
    pipName.textContent = activeChat.name || 'Cuộc trò chuyện';
    if (activeChat.avatar) {
      pipAvatar.src = activeChat.avatar;
      pipAvatar.style.display = 'block';
    } else {
      pipAvatar.style.display = 'none';
    }

    renderTabs();
    renderMessages(activeChat.messages || []);
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'expanded') {
      container.className = 'mode-expanded';
      setTimeout(() => {
        pipInput.focus();
        pipBody.scrollTop = pipBody.scrollHeight;
      }, 100);
    } else {
      container.className = 'mode-bubble';
    }
  }

  // --------------------------------------------------------------------------
  // Bridge Listeners
  // --------------------------------------------------------------------------
  bridge.onSync((data) => {
    if (!data) return;
    state.pinnedChats = data.pinnedChats || [];
    state.activeChatId = data.activeChatId || (state.pinnedChats[0] ? state.pinnedChats[0].id : null);
    if (data.mode) {
      setMode(data.mode);
    }
    updateActiveChatUI();
  });

  bridge.onModeChanged((mode) => {
    setMode(mode);
  });

  // Initial fetch
  bridge.getInitialState().then((initData) => {
    if (initData) {
      state.pinnedChats = initData.pinnedChats || [];
      state.activeChatId = initData.activeChatId || (state.pinnedChats[0] ? state.pinnedChats[0].id : null);
      if (initData.mode) setMode(initData.mode);
      updateActiveChatUI();
    }
  });

})();
