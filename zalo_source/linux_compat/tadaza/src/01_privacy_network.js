/* --------------------------------------------------------------------------
     1. Network Hooks for Privacy (Typing, Seen, Delivered)
     -------------------------------------------------------------------------- */
  function setupNetworkHooks() {
    if (window.__TADAZA_NETWORK_HOOKED__) return;
    window.__TADAZA_NETWORK_HOOKED__ = true;

    function checkUrlBlock(url) {
      if (!url || typeof url !== 'string') return null;
      if (currentConfig.privacy && currentConfig.privacy.hide_typing && /\/api\/(message|group)\/typing(?:\?|\/|#|$)/i.test(url)) {
        return 'typing';
      }
      if (currentConfig.privacy && currentConfig.privacy.hide_seen && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:seen|seenv2|react_seen)(?:\?|\/|#|$)/i.test(url)) {
        return 'seen';
      }
      if (currentConfig.privacy && currentConfig.privacy.hide_delivered && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:delivered|deliveredv2|react_delivered)(?:\?|\/|#|$)/i.test(url)) {
        return 'delivered';
      }
      return null;
    }

    // 1. Intercept XMLHttpRequest (Zalo uses Axios / Toxo wrapping XMLHttpRequest)
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        this._tadazaUrl = (url && typeof url.toString === 'function') ? url.toString() : String(url || '');
        this._tadazaMethod = method;
      } catch (e) { }
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const blockedReason = checkUrlBlock(this._tadazaUrl);
      if (blockedReason) {
        console.log(`[TADaZa Privacy] Blocked XHR (${blockedReason}):`, this._tadazaUrl);

        const mockPayload = JSON.stringify({
          error_code: 0,
          data: { ok: true },
          message: 'Success'
        });

        try {
          Object.defineProperty(this, 'readyState', { value: 4, writable: true, configurable: true });
          Object.defineProperty(this, 'status', { value: 200, writable: true, configurable: true });
          Object.defineProperty(this, 'statusText', { value: 'OK', writable: true, configurable: true });
          Object.defineProperty(this, 'responseText', { value: mockPayload, writable: true, configurable: true });
          Object.defineProperty(this, 'response', { value: mockPayload, writable: true, configurable: true });
          Object.defineProperty(this, 'responseURL', { value: this._tadazaUrl, writable: true, configurable: true });
        } catch (e) {
          this.readyState = 4;
          this.status = 200;
          this.statusText = 'OK';
          this.responseText = mockPayload;
          this.response = mockPayload;
        }

        this.getAllResponseHeaders = function () {
          return 'content-type: application/json; charset=utf-8\r\n';
        };
        this.getResponseHeader = function (header) {
          if (header && header.toLowerCase() === 'content-type') {
            return 'application/json; charset=utf-8';
          }
          return null;
        };

        setTimeout(() => {
          try {
            const readyEvt = new Event('readystatechange');
            if (typeof this.onreadystatechange === 'function') {
              this.onreadystatechange(readyEvt);
            }
            this.dispatchEvent(readyEvt);
          } catch (e) { }

          try {
            const loadEvt = new ProgressEvent('load');
            if (typeof this.onload === 'function') {
              this.onload(loadEvt);
            }
            this.dispatchEvent(loadEvt);
          } catch (e) { }

          try {
            const loadEndEvt = new ProgressEvent('loadend');
            if (typeof this.onloadend === 'function') {
              this.onloadend(loadEndEvt);
            }
            this.dispatchEvent(loadEndEvt);
          } catch (e) { }
        }, 10);

        return;
      }

      return origSend.apply(this, arguments);
    };

    // 2. Intercept window.fetch
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input && typeof input.url === 'string') {
        url = input.url;
      }
      const blockedReason = checkUrlBlock(url);
      if (blockedReason) {
        console.log(`[TADaZa Privacy] Blocked Fetch (${blockedReason}):`, url);
        return Promise.resolve(new Response(JSON.stringify({ error_code: 0, data: { ok: true } }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return origFetch.apply(this, arguments);
    };
  }
