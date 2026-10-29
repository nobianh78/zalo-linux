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

  function setupMessageTranslator() {
    // Remove any floating hover translate buttons from the DOM to keep chat clean
    document.querySelectorAll('.tadaza-trans-btn, #tadaza-hover-trans-btn').forEach(btn => btn.remove());
  }


  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
