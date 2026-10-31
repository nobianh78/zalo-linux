/* --------------------------------------------------------------------------
     1b. Reactions
     (a) Display fix. This Zalo build always renders reactions with the V2
     component (.message-reaction-container-v2), which reads from the V2
     reaction store. That store is only filled when
     settings.reaction_v2.enable_reaction_v2 is true, but the server sends
     false to this client. The message list then loads reactions the V1 way,
     the V2 store stays empty, and no reaction ever shows. Forcing the flag on
     makes the loader and the renderer agree.
     (b) Extra reactions. The picker shows settings.reactionMsgInfo, which the
     server limits to 6. Zalo's own icon map knows ~90 official reaction types
     that every client renders, so we append a few of those.
     -------------------------------------------------------------------------- */
  // rType values from Zalo's icon map: ok, thanks, pray, rose, broken heart,
  // clap, big grin, kiss, laugh, dislike, punch, victory.
  const TADAZA_EXTRA_REACTION_TYPES = [68, 70, 73, 120, 65, 46, 6, 8, 62, 4, 71, 69];

  let tadazaWebpackRequire = null;
  let tadazaZaloSettings = null;
  let tadazaIconMapSource = null;
  let tadazaBaseReactions = null;

  function findWebpackExport(test) {
    const req = tadazaWebpackRequire;
    if (!req || !req.c) return null;
    for (const key in req.c) {
      const exp = req.c[key] && req.c[key].exports;
      if (!exp) continue;
      for (const name of Object.keys(exp)) {
        let value;
        try { value = exp[name]; } catch (e) { continue; }
        try { if (value && test(value)) return value; } catch (e) { }
      }
    }
    return null;
  }

  function applyExtraReactions() {
    const settings = tadazaZaloSettings;
    if (!settings || !Array.isArray(settings.reactionMsgInfo)) return;
    const enabled = !(currentConfig.system && currentConfig.system.extra_reactions === false);
    document.body && document.body.classList.toggle('tadaza-extra-reactions', enabled);

    const current = settings.reactionMsgInfo;
    // The server can replace the list; remember whatever it sent last as the base.
    if (!current.__tadaza) tadazaBaseReactions = current;
    const base = tadazaBaseReactions || current;
    if (!enabled) {
      if (current !== base) settings.reactionMsgInfo = base;
      return;
    }
    if (current.__tadaza) return;

    if (!tadazaIconMapSource) {
      tadazaIconMapSource = findWebpackExport(v => typeof v.getIconMap === 'function' && v.getIconMap() && v.getIconMap()[5]);
    }
    const iconMap = tadazaIconMapSource ? tadazaIconMapSource.getIconMap() : null;
    if (!iconMap) return;

    const have = new Set(base.map(r => r && r.rType));
    const extra = TADAZA_EXTRA_REACTION_TYPES
      .filter(t => !have.has(t) && typeof iconMap[t] === 'string')
      .map(t => ({ rType: t, rIcon: iconMap[t] }));
    const merged = base.concat(extra);
    Object.defineProperty(merged, '__tadaza', { value: true });
    settings.reactionMsgInfo = merged;
  }

  function setupReactionV2Fix() {
    if (window.__TADAZA_REACTION_FIX__) return;
    window.__TADAZA_REACTION_FIX__ = true;

    const startedAt = Date.now();

    function grabRequire() {
      if (tadazaWebpackRequire || !Array.isArray(window.webpackJsonp)) return;
      const id = 'tadaza_req_' + startedAt;
      try {
        // A chunk whose entry module hands back __webpack_require__. If the runtime
        // has not loaded yet it picks the queued chunk up when it starts.
        window.webpackJsonp.push([[id], { [id]: (m, e, r) => { tadazaWebpackRequire = r; } }, [[id]]]);
      } catch (e) { }
    }

    function findSettings() {
      const req = tadazaWebpackRequire;
      if (!req || !req.c) return null;
      for (const key in req.c) {
        const mod = req.c[key];
        let def;
        try { def = mod && mod.exports && mod.exports.default; } catch (e) { continue; }
        if (def && typeof def === 'object' && def.reaction_v2 && typeof def.reaction_v2 === 'object' &&
            'enable_reaction_v2' in def.reaction_v2) {
          return def;
        }
      }
      return null;
    }

    // Server settings can be refreshed later, so keep re-applying.
    function enforce() {
      try {
        const rv2 = tadazaZaloSettings && tadazaZaloSettings.reaction_v2;
        if (rv2 && rv2.enable_reaction_v2 !== true) {
          rv2.enable_reaction_v2 = true;
          console.log('[TADaZa] Enabled reaction_v2 so reactions render');
        }
      } catch (e) { }
      try { applyExtraReactions(); } catch (e) { }
    }

    const finder = setInterval(() => {
      grabRequire();
      tadazaZaloSettings = findSettings();
      if (tadazaZaloSettings) {
        clearInterval(finder);
        enforce();
        setInterval(enforce, 2000);
      } else if (Date.now() - startedAt > 180000) {
        clearInterval(finder);
        console.warn('[TADaZa] Zalo settings not found; reaction fixes not applied');
      }
    }, 100);
  }
