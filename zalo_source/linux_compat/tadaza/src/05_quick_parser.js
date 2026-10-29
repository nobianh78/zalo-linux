/* --------------------------------------------------------------------------
     5. Quick Parser Feature (Bank STK, VietQR, Tracking & Phone Detection)
     -------------------------------------------------------------------------- */
  const VIETNAM_BANKS = [
    { bin: '970436', shortName: 'VCB', code: 'vietcombank', name: 'Vietcombank', aliases: ['vietcombank', 'vcb', 'vietcom'] },
    { bin: '970407', shortName: 'TCB', code: 'techcombank', name: 'Techcombank', aliases: ['techcombank', 'tcb', 'techcom'] },
    { bin: '970422', shortName: 'MB', code: 'mbbank', name: 'MBBank', aliases: ['mbbank', 'mb', 'quan doi'] },
    { bin: '970432', shortName: 'VPB', code: 'vpbank', name: 'VPBank', aliases: ['vpbank', 'vpb', 'vp'] },
    { bin: '970416', shortName: 'ACB', code: 'acb', name: 'ACB', aliases: ['acb', 'a chau'] },
    { bin: '970418', shortName: 'BIDV', code: 'bidv', name: 'BIDV', aliases: ['bidv'] },
    { bin: '970441', shortName: 'VIB', code: 'vib', name: 'VIB', aliases: ['vib', 'quoc te'] },
    { bin: '970423', shortName: 'TPB', code: 'tpbank', name: 'TPBank', aliases: ['tpbank', 'tpb', 'tien phong'] },
    { bin: '970415', shortName: 'CTG', code: 'vietinbank', name: 'VietinBank', aliases: ['vietinbank', 'ctg', 'vietin'] },
    { bin: '970403', shortName: 'STB', code: 'sacombank', name: 'Sacombank', aliases: ['sacombank', 'stb', 'sacom'] },
    { bin: '970437', shortName: 'HDB', code: 'hdbank', name: 'HDBank', aliases: ['hdbank', 'hdb'] },
    { bin: '970448', shortName: 'OCB', code: 'ocb', name: 'OCB', aliases: ['ocb', 'phuong dong'] },
    { bin: '970443', shortName: 'SHB', code: 'shb', name: 'SHB', aliases: ['shb'] },
    { bin: '970426', shortName: 'MSB', code: 'msb', name: 'MSB', aliases: ['msb', 'hang hai'] },
    { bin: '970449', shortName: 'LPB', code: 'lpbank', name: 'LPBank', aliases: ['lpbank', 'lpb', 'lienvietpostbank', 'lienviet'] },
    { bin: '970440', shortName: 'SeABank', code: 'seabank', name: 'SeABank', aliases: ['seabank', 'sea'] },
    { bin: '970424', shortName: 'Shinhan', code: 'shinhanbank', name: 'Shinhan Bank', aliases: ['shinhan', 'shinhanbank'] },
    { bin: '546034', shortName: 'Cake', code: 'cake', name: 'Cake by VPBank', aliases: ['cake'] },
    { bin: '963388', shortName: 'Timo', code: 'timo', name: 'Timo', aliases: ['timo'] },
    { bin: '971005', shortName: 'ViettelMoney', code: 'viettelmoney', name: 'Viettel Money', aliases: ['viettelmoney', 'viettelpay', 'viettel'] },
    { bin: '971011', shortName: 'VNPTMoney', code: 'vnptmoney', name: 'VNPT Money', aliases: ['vnptmoney', 'vnpt'] }
  ];

  const TRACKING_PATTERNS = [
    {
      carrier: 'Shopee Express (SPX)',
      code: 'spx',
      regex: /\b(SPXVN[0-9A-Za-z]{8,14}|VN\d{12,15}[A-Za-z]?)\b/i,
      url: (c) => `https://spx.vn/track?tracking_number=${c}`
    },
    {
      carrier: 'Giao Hàng Tiết Kiệm (GHTK)',
      code: 'ghtk',
      regex: /(?:ghtk|tiết\s*kiệm)[^\d]{0,20}([0-9]{9,11}|S\d+\.[A-Za-z0-9.]+)\b/i,
      url: (c) => `https://i.ghtk.vn/${c}`
    },
    {
      carrier: 'Viettel Post',
      code: 'viettelpost',
      regex: /(?:viettel|vtp)[^\d]{0,20}(VT[0-9A-Za-z]{9,12}|[0-9]{9,12})\b/i,
      url: (c) => `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?order_number=${c}`
    },
    {
      carrier: 'J&T Express',
      code: 'jtexpress',
      regex: /(?:j&t|jnt)[^\d]{0,20}([0-9]{10,12}|JNT[0-9A-Za-z]{8,12})\b/i,
      url: (c) => `https://jtexpress.vn/vi/tracking?type=track&billcode=${c}`
    }
  ];

  const BANK_STOP_WORDS = new Set([
    'ck', 'cho', 'tao', 'to', 'tớ', 'minh', 'mình', 'ban', 'bạn', 'anh', 'em', 'chi', 'chị',
    'vao', 'vào', 'qua', 'sang', 'gui', 'gửi', 'ho', 'hộ', 'nhe', 'nhé', 'nha', 'cai', 'cái',
    'nay', 'này', 'thi', 'thì', 'no', 'nó', 'khong', 'không', 'nhan', 'nhận', 'duoc', 'được',
    'tien', 'tiền', 'chuyen', 'chuyển', 'khoan', 'khoản', 'so', 'số', 'tai', 'tài', 'bao',
    'nhieu', 'nhiều', 'voi', 'với', 'ok', 'rep', 'giup', 'giúp', 'di', 'đi', 'roi', 'rồi', 'xong',
    'chua', 'chưa', 'ngay', 'hom', 'hôm', 'gio', 'giờ', 'tk', 'stk', 'gia', 'giá', 'fix', 'bot',
    'bớt', 'shop', 'bac', 'bác', 'ong', 'ông', 'chu', 'chú', 'noi', 'nội', 'dung',
    'la', 'là', 'cua', 'của', 'day', 'đây', 'ạ', 'a'
  ]);

  function parseBankInfo(text) {
    if (!text || typeof text !== 'string') return null;
    const textLower = text.toLowerCase();

    // 1. Identify amount first
    let amount = null;
    let amountRawStr = '';
    const amtMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(k|củ|tr|triệu|đ|d|vnd|dong|đồng)\b/i);
    if (amtMatch) {
      amountRawStr = amtMatch[0];
      const numStr = amtMatch[1].replace(/\./g, '').replace(/,/g, '.');
      const unit = amtMatch[2].toLowerCase();
      const val = parseFloat(numStr);
      if (unit === 'k') amount = Math.round(val * 1000);
      else if (['tr', 'triệu', 'củ'].includes(unit)) amount = Math.round(val * 1000000);
      else amount = Math.round(val);
    } else {
      const amtMatch2 = text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
      if (amtMatch2) {
        const num = amtMatch2[1].replace(/[.,]/g, '');
        if (parseInt(num, 10) >= 1000) {
          amount = parseInt(num, 10);
          amountRawStr = amtMatch2[0];
        }
      }
    }

    // 2. Identify bank
    let foundBank = null;
    let bankMatchIndex = -1;
    let bankMatchLength = 0;
    for (const b of VIETNAM_BANKS) {
      for (const a of b.aliases) {
        const reg = new RegExp(`\\b${a}\\b`, 'i');
        const m = textLower.match(reg);
        if (m) {
          foundBank = b;
          bankMatchIndex = m.index;
          bankMatchLength = m[0].length;
          break;
        }
      }
      if (foundBank) break;
    }

    const hasBankKeyword = /\b(stk|số\s*tk|tài\s*khoản|chuyển\s*khoản|ck|c\/k|alias|nickname)\b/i.test(textLower);
    if (!foundBank && !hasBankKeyword) return null;

    // Helper: validate account candidate (digits or alphanumeric alias)
    function isValidAccountCandidate(candidate, rawOriginalWord) {
      if (!candidate || typeof candidate !== 'string') return false;
      const candLower = candidate.toLowerCase();
      if (VIETNAM_BANKS.some(b => b.aliases.includes(candLower))) return false;
      if (BANK_STOP_WORDS.has(candLower)) return false;
      if (amountRawStr && (candidate === amountRawStr || candLower === amountRawStr.toLowerCase())) return false;
      if (/^\d+(k|tr|cu|củ|vnd|d|đ)?$/i.test(candLower) && candLower.endsWith('k')) return false;
      // If the original token in text has Vietnamese accents (e.g., "chuyển" -> "chuy"), it is NOT an alias
      if (rawOriginalWord && /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(rawOriginalWord)) {
        return false;
      }
      if (candidate.length < 4 || candidate.length > 25) return false;
      return true;
    }

    // 3. Identify account number or alias
    let accountNo = null;

    // Pattern A: Explicit prefix (stk, tk, số tk, tài khoản, alias, nickname)
    const prefixRegex = /(?:stk|số\s*tk|tk|tài\s*khoản|alias|nickname|nick)[\s:]+([A-Za-z0-9_.-]{4,25})\b/i;
    const pMatch = text.match(prefixRegex);
    if (pMatch) {
      const candidate = pMatch[1];
      const fullWordMatch = text.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
      const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
      if (isValidAccountCandidate(candidate, fullWord)) {
        accountNo = candidate;
      }
    }

    // Pattern B: Traditional numeric STK (6-19 digits)
    if (!accountNo) {
      const numericCandidates = text.match(/\b[0-9]{6,19}\b/g);
      if (numericCandidates && numericCandidates.length > 0) {
        for (const num of numericCandidates) {
          if (amount && (num === String(amount) || num === amountRawStr.replace(/[.,]/g, ''))) {
            continue;
          }
          accountNo = num;
          break;
        }
      }
    }

    // Pattern C: If bank was found, check adjacent/nearby tokens for Nickname/Alias
    if (!accountNo && foundBank) {
      // Check right after bank: e.g. "tpbank nobianh78" or "tpbank : nobianh78" or "tpbank stk nobianh78"
      const afterBankStr = text.substring(bankMatchIndex + bankMatchLength);
      const afterMatch = afterBankStr.match(/^[\s:,-]*(?:stk|tk|la|là|cua|của|so|số|nick|alias)?[\s:,-]*([A-Za-z0-9_.-]{4,25})\b/i);
      if (afterMatch) {
        const candidate = afterMatch[1];
        const fullWordMatch = afterBankStr.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
        const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
        if (isValidAccountCandidate(candidate, fullWord)) {
          const hasDigits = /\d/.test(candidate);
          if (hasDigits || hasBankKeyword || amount || candidate.length >= 6) {
            accountNo = candidate;
          }
        }
      }

      // Check right before bank: e.g. "nobianh78 tpbank"
      if (!accountNo) {
        const beforeBankStr = text.substring(0, bankMatchIndex);
        const beforeMatch = beforeBankStr.match(/([A-Za-z0-9_.-]{4,25})[\s:,-]*$/i);
        if (beforeMatch) {
          const candidate = beforeMatch[1];
          const fullWordMatch = beforeBankStr.match(new RegExp(`\\b${candidate}[a-zA-Z0-9À-ỹ]*`, 'i'));
          const fullWord = fullWordMatch ? fullWordMatch[0] : candidate;
          if (isValidAccountCandidate(candidate, fullWord)) {
            const hasDigits = /\d/.test(candidate);
            if (hasDigits || hasBankKeyword || amount || candidate.length >= 6) {
              accountNo = candidate;
            }
          }
        }
      }
    }

    if (!accountNo) return null;

    // 4. Identify Account Name (Title Case or UPPERCASE 2-5 words)
    let accountName = '';
    let cleanedForName = text.replace(new RegExp(accountNo, 'g'), '');
    cleanedForName = cleanedForName.replace(/\b\d+([.,]\d+)?\s*(k|củ|tr|triệu|đ|d|vnd|dong|đồng)?\b/gi, '');
    cleanedForName = cleanedForName.replace(/(?:^|\s+)(?:stk|số\s*tk|tk|tài\s*khoản|chuyển\s*khoản|ck|tiền|c\/k|vao|vào|cho|to|tớ|minh|mình|nhé|nha|vcb|tcb|mb|bidv|acb|vietcombank|techcombank|mbbank|tpbank)(?=\s+|$)/gi, ' ');
    const nameMatches = cleanedForName.match(/\b[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){1,4}\b/g);
    if (nameMatches && nameMatches.length > 0) {
      const valid = nameMatches.filter(n => {
        const words = n.trim().split(/\s+/);
        return words.length >= 2 && words.every(w => /^[A-ZÀ-Ỹ]/.test(w));
      });
      if (valid.length > 0) {
        accountName = valid.reduce((a, b) => a.length >= b.length ? a : b).trim();
      }
    }

    return {
      bank: foundBank || { bin: '970436', shortName: 'BANK', code: 'vietcombank', name: 'Ngân hàng' },
      accountNo,
      amount,
      accountName
    };
  }

  function parseTrackingInfo(text) {
    if (!text || typeof text !== 'string') return null;
    for (const item of TRACKING_PATTERNS) {
      const m = text.match(item.regex);
      if (m) {
        const code = m[1];
        return {
          carrier: item.carrier,
          code,
          url: item.url(code)
        };
      }
    }
    const spxMatch = text.match(/\b(SPXVN[0-9A-Za-z]{8,14})\b/i);
    if (spxMatch) {
      const code = spxMatch[1];
      return {
        carrier: 'Shopee Express (SPX)',
        code,
        url: `https://spx.vn/track?tracking_number=${code}`
      };
    }
    return null;
  }

  function parsePhoneNumber(text) {
    if (!text || typeof text !== 'string') return null;
    const m = text.match(/\b(?:\+84|0)(?:3|5|7|8|9)\d{8}\b/);
    return m ? m[0] : null;
  }

  function formatCurrencyVND(amount) {
    if (!amount) return '';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  }

  let vietqrModal = null;

  function openVietQRModal({ bank, accountNo, amount, accountName, note = '' }) {
    if (!vietqrModal) {
      vietqrModal = document.createElement('div');
      vietqrModal.id = 'tadaza-vietqr-overlay';
      document.body.appendChild(vietqrModal);
    }

    const template = (currentConfig.quick_parser && currentConfig.quick_parser.default_qr_template) || 'compact2';
    const params = new URLSearchParams();
    if (amount) params.append('amount', amount);
    if (accountName) params.append('accountName', accountName);
    if (note) params.append('addInfo', note);

    const bankIdentifier = bank.bin || bank.code || bank.shortName;
    const qrImageUrl = `https://img.vietqr.io/image/${bankIdentifier}-${accountNo}-${template}.png?${params.toString()}`;

    vietqrModal.innerHTML = `
      <div id="tadaza-vietqr-modal">
        <div class="tadaza-vietqr-header">
          <div class="tadaza-vietqr-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            <span>Mã VietQR Chuyển Khoản</span>
          </div>
          <button class="tadaza-close-btn" id="tadaza-vietqr-close" title="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="tadaza-vietqr-body">
          <div class="tadaza-qr-img-wrap">
            <img class="tadaza-qr-img" id="tadaza-qr-img-elem" src="${qrImageUrl}" alt="VietQR Code" />
          </div>

          <div class="tadaza-vietqr-details">
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Ngân hàng:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-bank-badge">${escapeHtml(bank.shortName)}</span>
                <span class="tadaza-detail-val">${escapeHtml(bank.name)}</span>
              </div>
            </div>

            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Số tài khoản:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val" id="val-qr-stk">${escapeHtml(accountNo)}</span>
                <button class="tadaza-copy-mini-btn" id="btn-qr-copy-stk" title="Sao chép STK">Sao chép</button>
              </div>
            </div>

            ${accountName ? `
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Chủ tài khoản:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val" style="text-transform: uppercase;">${escapeHtml(accountName)}</span>
              </div>
            </div>` : ''}

            ${amount ? `
            <div class="tadaza-detail-row">
              <span class="tadaza-detail-label">Số tiền:</span>
              <div class="tadaza-detail-val-wrap">
                <span class="tadaza-detail-val tadaza-parser-amount">${formatCurrencyVND(amount)}</span>
                <button class="tadaza-copy-mini-btn" id="btn-qr-copy-amount" title="Sao chép số tiền">Sao chép</button>
              </div>
            </div>` : ''}
          </div>
        </div>

        <div class="tadaza-vietqr-footer">
          <button class="tadaza-action-btn secondary" id="tadaza-vietqr-btn-close">Đóng</button>
          <div style="display: flex; gap: 8px;">
            <button class="tadaza-action-btn secondary" id="tadaza-vietqr-btn-copy-img" title="Sao chép ảnh QR">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="label-qr-copy-img">Sao chép ảnh QR</span>
            </button>
            <button class="tadaza-action-btn primary" id="tadaza-vietqr-btn-download" title="Tải ảnh QR về máy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Tải ảnh</span>
            </button>
          </div>
        </div>
      </div>
    `;

    vietqrModal.classList.add('open');

    const closeModal = () => vietqrModal.classList.remove('open');
    vietqrModal.querySelector('#tadaza-vietqr-close').addEventListener('click', closeModal);
    vietqrModal.querySelector('#tadaza-vietqr-btn-close').addEventListener('click', closeModal);
    vietqrModal.addEventListener('click', (e) => {
      if (e.target === vietqrModal) closeModal();
    });

    // Copy STK
    const copyStkBtn = vietqrModal.querySelector('#btn-qr-copy-stk');
    if (copyStkBtn) {
      copyStkBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(accountNo);
        copyStkBtn.textContent = 'Đã chép!';
        setTimeout(() => { copyStkBtn.textContent = 'Sao chép'; }, 1500);
      });
    }

    // Copy Amount
    const copyAmtBtn = vietqrModal.querySelector('#btn-qr-copy-amount');
    if (copyAmtBtn && amount) {
      copyAmtBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(amount.toString());
        copyAmtBtn.textContent = 'Đã chép!';
        setTimeout(() => { copyAmtBtn.textContent = 'Sao chép'; }, 1500);
      });
    }

    // Copy QR Image
    const copyImgBtn = vietqrModal.querySelector('#tadaza-vietqr-btn-copy-img');
    if (copyImgBtn) {
      copyImgBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(qrImageUrl);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = async () => {
            const dataUri = reader.result;
            if (bridge.copyImage) await bridge.copyImage(dataUri);
          };
          reader.readAsDataURL(blob);
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          }
          const label = vietqrModal.querySelector('#label-qr-copy-img');
          label.textContent = 'Đã chép ảnh!';
          setTimeout(() => { label.textContent = 'Sao chép ảnh QR'; }, 1500);
        } catch (err) {
          console.warn('[TADaZa] Failed to copy QR image:', err);
        }
      });
    }

    // Download QR Image
    const dlBtn = vietqrModal.querySelector('#tadaza-vietqr-btn-download');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = qrImageUrl;
        a.download = `VietQR_${bank.shortName}_${accountNo}.png`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }
  }

  function setupQuickParser() {
    let scanTimeout = null;

    const scanMessages = () => {
      const qp = currentConfig.quick_parser;
      if (!qp || !qp.enabled) return;

      const targets = document.querySelectorAll(
        '.text-message__container:not([data-tadaza-parsed]), ' +
        '[class*="bubble-content"]:not([data-tadaza-parsed]), ' +
        '[class*="msg-content"]:not([data-tadaza-parsed])'
      );

      targets.forEach(elem => {
        if (elem.closest('.tadaza-trans-box') || elem.closest('.tadaza-parser-box') || elem.closest('#tadaza-code-studio-overlay') || elem.closest('#tadaza-vietqr-overlay')) {
          return;
        }

        if (elem.querySelector('.text-message__container') || elem.querySelector('[class*="bubble-content"]')) {
          return;
        }

        elem.setAttribute('data-tadaza-parsed', '1');

        const rawText = extractMessageText(elem);
        if (!rawText || rawText.length < 5) return;

        const chatMsg = elem.closest('.chat-message, [class*="msg-item"], [class*="chat-item"]');
        const parentToAttach = elem.closest('.message-content-render')
          || (chatMsg ? chatMsg.querySelector('.message-content-render') : null)
          || elem.closest('.text-message__container')
          || elem.closest('[class*="bubble"]')
          || elem;

        // 1. Check Bank Transfer
        if (qp.auto_detect_bank) {
          const bankInfo = parseBankInfo(rawText);
          if (bankInfo) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span class="tadaza-bank-badge">${escapeHtml(bankInfo.bank.shortName)}</span>
                  <span>${escapeHtml(bankInfo.bank.name)}</span>
                </div>
                ${bankInfo.amount ? `<span class="tadaza-parser-amount">${formatCurrencyVND(bankInfo.amount)}</span>` : ''}
              </div>
              <div class="tadaza-parser-content">
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">STK:</span>
                  <span class="tadaza-parser-val">${escapeHtml(bankInfo.accountNo)}</span>
                </div>
                ${bankInfo.accountName ? `
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">Tên:</span>
                  <span class="tadaza-parser-val" style="text-transform: uppercase;">${escapeHtml(bankInfo.accountName)}</span>
                </div>` : ''}
              </div>
              <div class="tadaza-parser-actions">
                <button class="tadaza-parser-btn vietqr" title="Mở mã QR chuẩn VietQR quét chuyển tiền ngay">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <span>Tạo VietQR</span>
                </button>
                <button class="tadaza-parser-btn btn-copy-stk" title="Sao chép số tài khoản">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span class="btn-text">Chép STK</span>
                </button>
                ${bankInfo.amount ? `
                <button class="tadaza-parser-btn btn-copy-amt" title="Sao chép số tiền">
                  <span class="btn-text">Chép số tiền</span>
                </button>` : ''}
              </div>
            `;

            box.querySelector('.vietqr').addEventListener('click', (e) => {
              e.stopPropagation();
              openVietQRModal(bankInfo);
            });

            const copyStkBtn = box.querySelector('.btn-copy-stk');
            copyStkBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(bankInfo.accountNo);
              const txt = copyStkBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Chép STK'; }, 1500);
            });

            const copyAmtBtn = box.querySelector('.btn-copy-amt');
            if (copyAmtBtn && bankInfo.amount) {
              copyAmtBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await navigator.clipboard.writeText(bankInfo.amount.toString());
                const txt = copyAmtBtn.querySelector('.btn-text');
                txt.textContent = 'Đã chép!';
                setTimeout(() => { txt.textContent = 'Chép số tiền'; }, 1500);
              });
            }

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
            return;
          }
        }

        // 2. Check Tracking Code
        if (qp.auto_detect_tracking) {
          const tracking = parseTrackingInfo(rawText);
          if (tracking) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span style="font-size: 15px;">🚚</span>
                  <span>${escapeHtml(tracking.carrier)}</span>
                </div>
              </div>
              <div class="tadaza-parser-content">
                <div class="tadaza-parser-field">
                  <span style="opacity: 0.7;">Mã vận đơn:</span>
                  <span class="tadaza-parser-val">${escapeHtml(tracking.code)}</span>
                </div>
              </div>
              <div class="tadaza-parser-actions">
                <button class="tadaza-parser-btn btn-track" style="background:#0068ff; color:#fff; border:none;" title="Mở trang web tra cứu hành trình đơn hàng">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <span>Tra cứu đơn</span>
                </button>
                <button class="tadaza-parser-btn btn-copy-track" title="Sao chép mã vận đơn">
                  <span class="btn-text">Chép mã</span>
                </button>
              </div>
            `;

            box.querySelector('.btn-track').addEventListener('click', async (e) => {
              e.stopPropagation();
              if (bridge.openExternal) {
                await bridge.openExternal(tracking.url);
              } else {
                window.open(tracking.url, '_blank');
              }
            });

            const copyTrackBtn = box.querySelector('.btn-copy-track');
            copyTrackBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(tracking.code);
              const txt = copyTrackBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Chép mã'; }, 1500);
            });

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
            return;
          }
        }

        // 3. Check Phone Number
        if (qp.auto_detect_phone) {
          const phone = parsePhoneNumber(rawText);
          if (phone) {
            const box = document.createElement('div');
            box.className = 'tadaza-parser-box';
            box.innerHTML = `
              <div class="tadaza-parser-header">
                <div class="tadaza-parser-title">
                  <span style="font-size: 14px;">📞</span>
                  <span>Số điện thoại:</span>
                  <span class="tadaza-parser-val">${escapeHtml(phone)}</span>
                </div>
                <div class="tadaza-parser-actions" style="margin-top:0;">
                  <button class="tadaza-parser-btn btn-copy-phone" title="Sao chép số điện thoại">
                    <span class="btn-text">Sao chép SĐT</span>
                  </button>
                </div>
              </div>
            `;

            const copyPhoneBtn = box.querySelector('.btn-copy-phone');
            copyPhoneBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await navigator.clipboard.writeText(phone);
              const txt = copyPhoneBtn.querySelector('.btn-text');
              txt.textContent = 'Đã chép!';
              setTimeout(() => { txt.textContent = 'Sao chép SĐT'; }, 1500);
            });

            if (parentToAttach && parentToAttach.parentElement) {
              parentToAttach.insertAdjacentElement('afterend', box);
            }
          }
        }
      });
    };

    scanMessages();

    const observer = new MutationObserver(() => {
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanMessages, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
