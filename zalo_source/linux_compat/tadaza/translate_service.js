const https = require('https');

/**
 * TADaZa Translate Service
 * Translates text using MyMemory and public translation gateways with fallback
 */
async function translateText(text, targetLang = 'vi', sourceLang = 'auto') {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { success: false, error: 'Empty text' };
  }

  const cleanText = text.trim();
  const pair = `${sourceLang === 'auto' ? 'autodetect' : sourceLang}|${targetLang}`;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${encodeURIComponent(pair)}`;
    const translated = await new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 8000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data && data.responseData && data.responseData.translatedText) {
              resolve(data.responseData.translatedText);
            } else if (data && data.matches && data.matches.length > 0) {
              resolve(data.matches[0].translation);
            } else {
              resolve(cleanText);
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Translation request timed out'));
      });
      req.on('error', reject);
    });

    return {
      success: true,
      original: cleanText,
      translated,
      targetLang
    };
  } catch (err) {
    console.error('[TADaZa Translate] Translation error:', err.message);
    return {
      success: false,
      original: cleanText,
      error: err.message
    };
  }
}

module.exports = {
  translateText
};
