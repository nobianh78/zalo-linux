/* --------------------------------------------------------------------------
     2. Apply Configuration to DOM
     -------------------------------------------------------------------------- */
  function applyTheme(cfg) {
    const isDark = cfg.theme.mode === 'dark' || (cfg.theme.mode === 'system' && (cfg._systemIsDark || window.matchMedia('(prefers-color-scheme: dark)').matches));

    if (isDark) {
      document.body.classList.add('dark');
      if (cfg.theme.deep_dark) {
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
