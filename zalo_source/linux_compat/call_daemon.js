/**
 * Native Linux Call Daemon for Zalo PC
 * Full Native Call Engine:
 * - Media Backend (UDP/ZRTP/SRTP/Opus audio) via PipeWire/ALSA
 * - Video Support (WebCodecs H.264 Annex-B decode & encode with local camera & remote canvas)
 * - Device Settings Modal (Microphone, Speaker, Camera selection, mic meter, test sound)
 */

const net = require("net");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
let electron = null;
try {
  electron = require("electron");
} catch (e) {}

const { EngineCore } = require("./zcall_native/engine-core");
const { ZrtcMediaBackend } = require("./zcall_native/backends/zrtc-media");

const LOG_FILE = "/tmp/zalo_call_daemon.log";
function logDebug(dir, data) {
  try {
    const line = `[${new Date().toISOString()}] [${dir}] ${typeof data === "string" ? data : JSON.stringify(data)}\n`;
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {}
}

const AES_KEY = Buffer.from("yjAF9oqMWl6XfXYJn9mA7w==", "base64");
const AES_IV = Buffer.alloc(16, 0);

function encrypt(text) {
  const cipher = crypto.createCipheriv("aes-128-cbc", AES_KEY, AES_IV);
  return Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("hex");
}

function decrypt(hex) {
  const decipher = crypto.createDecipheriv("aes-128-cbc", AES_KEY, AES_IV);
  return Buffer.concat([decipher.update(Buffer.from(hex, "hex")), decipher.final()]).toString("utf8");
}

const DEFAULT_DEVICES = {
  defaultAudInputDevice: {
    guid: "{0.0.1.00000000}.{25DA76D0-033C-4235-9002-19F48894AC6F}",
    id: 0,
    name: "PulseAudio / PipeWire Input"
  },
  defaultAudOutputDevice: {
    guid: "{0.0.0.00000000}.{FD47D9CC-4218-4135-9CE2-0C195C87405B}",
    id: 0,
    name: "PulseAudio / PipeWire Output"
  },
  defaultVidDevice: {
    id: "default",
    name: "HP Wide Vision HD Camera"
  },
  otherAudInputDevice: [
    {
      guid: "{0.0.1.00000000}.{25DA76D0-033C-4235-9002-19F48894AC6F}",
      id: 0,
      name: "PulseAudio / PipeWire Input"
    }
  ],
  otherAudOutputDevice: [
    {
      guid: "{0.0.0.00000000}.{FD47D9CC-4218-4135-9CE2-0C195C87405B}",
      id: 0,
      name: "PulseAudio / PipeWire Output"
    }
  ],
  otherVidDevice: [
    {
      id: "default",
      name: "HP Wide Vision HD Camera"
    }
  ]
};

class ZaloCallDaemon {
  constructor(recvPath, sendPath) {
    this.recvPath = recvPath || "/tmp/socketzalorecv2021";
    this.sendPath = sendPath || "/tmp/socketzalosend2021";
    this.toElectron = null;
    this.fromElectron = null;
    this.readBuffer = "";
    this.chunks = {};
    this.queue = [];
    this.callWindow = null;
    this.localUser = null;
    this.pendingAccept = null;
    this.pendingReject = null;
    this.hangupCb = null;
    this.muteCb = null;
    this.cameraCb = null;
    this.screenCb = null;
    this.videoFrameCb = null;
    this.deviceCb = null;
    this.micVolumeCb = null;

    this.setupIpcMain();
    this.initEngine();
  }

  setupIpcMain() {
    if (!electron || !electron.ipcMain) return;

    electron.ipcMain.removeAllListeners("call-action-answer");
    electron.ipcMain.removeAllListeners("call-action-decline");
    electron.ipcMain.removeAllListeners("call-action-end");
    electron.ipcMain.removeAllListeners("call-action-mute");
    electron.ipcMain.removeAllListeners("call-action-camera");
    electron.ipcMain.removeAllListeners("call-action-share-screen");
    electron.ipcMain.removeAllListeners("call-action-video-frame");
    electron.ipcMain.removeAllListeners("call-action-device");
    electron.ipcMain.removeAllListeners("call-action-mic-volume");
    electron.ipcMain.removeAllListeners("call-action-expand-video");
    electron.ipcMain.removeAllListeners("call-action-need-key");
    electron.ipcMain.removeHandler("call-get-screen-sources");

    electron.ipcMain.handle("call-get-screen-sources", async () => {
      try {
        if (!electron.desktopCapturer) return [];
        const sources = await electron.desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 320, height: 180 },
          fetchWindowIcons: true
        });
        return sources.map(s => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
          appIcon: s.appIcon ? s.appIcon.toDataURL() : null
        }));
      } catch (err) {
        logDebug("IPC", "call-get-screen-sources error: " + err.message);
        return [];
      }
    });

    electron.ipcMain.on("call-action-answer", () => {
      logDebug("IPC", "call-action-answer received");
      if (this.pendingAccept) {
        const fn = this.pendingAccept;
        this.pendingAccept = null;
        fn();
      }
    });

    electron.ipcMain.on("call-action-decline", () => {
      logDebug("IPC", "call-action-decline received");
      if (this.pendingReject) {
        const fn = this.pendingReject;
        this.pendingReject = null;
        fn("reject");
      }
    });

    electron.ipcMain.on("call-action-end", () => {
      logDebug("IPC", "call-action-end received");
      if (this.hangupCb) {
        this.hangupCb();
      }
    });

    electron.ipcMain.on("call-action-mute", (e, isMuted) => {
      logDebug("IPC", `call-action-mute: ${isMuted}`);
      if (this.muteCb) {
        this.muteCb(isMuted);
      }
    });

    electron.ipcMain.on("call-action-camera", (e, on) => {
      logDebug("IPC", `call-action-camera: ${on}`);
      if (this.cameraCb) {
        this.cameraCb(on);
      }
    });

    electron.ipcMain.on("call-action-share-screen", (e, on) => {
      logDebug("IPC", `call-action-share-screen: ${on}`);
      if (this.screenCb) {
        this.screenCb(on);
      }
    });

    electron.ipcMain.on("call-action-video-frame", (e, frame) => {
      if (this.videoFrameCb && frame && frame.data) {
        this.videoFrameCb({
          key: !!frame.key,
          codec: frame.codec || "avc1.42e02a",
          data: Buffer.from(frame.data),
          screen: !!frame.screen,
          w: frame.w || 640,
          h: frame.h || 480
        });
      }
    });

    electron.ipcMain.on("call-action-device", (e, { kind, name }) => {
      logDebug("IPC", `call-action-device: ${kind} -> ${name}`);
      if (this.deviceCb) {
        this.deviceCb(kind, name);
      }
    });

    electron.ipcMain.on("call-action-mic-volume", (e, pct) => {
      if (this.micVolumeCb) {
        this.micVolumeCb(pct);
      }
    });

    electron.ipcMain.on("call-action-expand-video", () => {
      if (this.callWindow && !this.callWindow.isDestroyed()) {
        const [w, h] = this.callWindow.getSize();
        if (w < 850) {
          this.callWindow.setSize(900, 650, true);
          this.callWindow.center();
        }
      }
    });

    electron.ipcMain.on("call-action-need-key", () => {
      if (this.engine && typeof this.engine._askPeerKey === "function") {
        this.engine._askPeerKey("renderer-req");
      }
    });
  }

  initEngine() {
    this.media = new ZrtcMediaBackend({
      log: (...args) => logDebug("MEDIA", args.join(" ")),
      sendUdp: true,
      audio: true
    });

    const uiAdapter = {
      open: (opts) => {
        logDebug("UI", `open: ${JSON.stringify(opts)}`);
        this.openCallWindow({ name: opts.title, avatar: opts.avatar }, opts.text || "Đang gọi...", false, !!opts.video);
      },
      incoming: (opts, onAccept, onReject) => {
        logDebug("UI", `incoming: ${JSON.stringify(opts)}`);
        this.pendingAccept = onAccept;
        this.pendingReject = onReject;
        this.openCallWindow({ name: opts.title, avatar: opts.avatar }, opts.text || "Cuộc gọi đến...", true, !!opts.video);
      },
      status: (text, since = 0) => {
        logDebug("UI", `status: ${text} (since=${since})`);
        this.updateCallWindowStatus(text);
        if (text === "Đã kết nối" || since > 0) {
          this.updateCallWindowConnected();
        }
      },
      video: (f) => {
        if (this.callWindow && !this.callWindow.isDestroyed()) {
          this.callWindow.webContents.send("remote-video-frame", {
            key: f.key,
            codec: f.codec || "avc1.42e02a",
            data: f.data
          });
        }
      },
      requestKeyFrame: () => {
        if (this.callWindow && !this.callWindow.isDestroyed()) {
          this.callWindow.webContents.send("request-keyframe");
        }
      },
      close: (text) => {
        logDebug("UI", `close: ${text}`);
        this.pendingAccept = null;
        this.pendingReject = null;
        if (this.callWindow && !this.callWindow.isDestroyed()) {
          this.callWindow.close();
          this.callWindow = null;
        }
      },
      onHangup: (cb) => {
        this.hangupCb = cb;
      },
      onMute: (cb) => {
        this.muteCb = cb;
      },
      onCamera: (cb) => {
        this.cameraCb = cb;
      },
      onScreen: (cb) => {
        this.screenCb = cb;
      },
      onVideoFrame: (cb) => {
        this.videoFrameCb = cb;
      },
      onDevice: (cb) => {
        this.deviceCb = cb;
      },
      onMicVolume: (cb) => {
        this.micVolumeCb = cb;
      },
      rename: (alias) => {
        if (this.callWindow && !this.callWindow.isDestroyed()) {
          this.callWindow.webContents.executeJavaScript(`
            const nameEl = document.querySelector('.name');
            if (nameEl) nameEl.innerText = ${JSON.stringify(alias)};
          `);
        }
      },
      peer: (p) => {
        logDebug("UI", `peer: ${JSON.stringify(p)}`);
        if (this.callWindow && !this.callWindow.isDestroyed()) {
          this.callWindow.webContents.send("peer-state", p);
        }
      }
    };

    this.engine = new EngineCore({
      emit: (frame) => this.send(frame),
      media: this.media,
      log: (...args) => logDebug("ENGINE", args.join(" ")),
      ui: uiAdapter,
      group: true
    });
  }

  start() {
    console.log("[CallDaemon] Starting with sockets:", this.recvPath, this.sendPath);
    logDebug("START", { recv: this.recvPath, send: this.sendPath });
    this.connectRecv();
    this.connectSend();
  }

  connectRecv(retryCount = 0) {
    this.toElectron = net.createConnection(this.recvPath, () => {
      console.log("[CallDaemon] Connected to Electron serverRecv");
      if (this.engine) {
        this.engine.start();
      } else {
        this.send({ type: "update", command: "native-ready" });
      }
      while (this.queue.length > 0) {
        this.send(this.queue.shift());
      }
    });

    this.toElectron.on("error", (err) => {
      if (retryCount < 40) {
        setTimeout(() => this.connectRecv(retryCount + 1), 300);
      } else {
        console.error("[CallDaemon] toElectron error:", err.message);
      }
    });
  }

  connectSend(retryCount = 0) {
    this.fromElectron = net.createConnection(this.sendPath, () => {
      console.log("[CallDaemon] Connected to Electron serverSend");
    });

    this.fromElectron.on("data", (chunk) => {
      this.readBuffer += chunk.toString();
      const parts = this.readBuffer.split("$");
      this.readBuffer = parts.pop();
      for (let raw of parts) {
        if (!raw) continue;
        raw = raw.trim();
        const m = /^([0-9a-f]*)#(\d+)#(\d+)#(\d+)#$/.exec(raw);
        if (m) {
          const [, part, id, total, index] = m;
          const chunks = (this.chunks = this.chunks || {})[id] = this.chunks[id] || [];
          chunks[+index] = part;
          if (chunks.filter(p => p !== undefined).length < +total) continue;
          delete this.chunks[id];
          raw = chunks.join("");
        }
        try {
          const jsonStr = decrypt(raw).replace(/[\0]/g, "");
          const msg = JSON.parse(jsonStr);
          logDebug("RECV", msg);
          this.handleMessage(msg);
        } catch (e) {
          console.error("[CallDaemon] Decrypt/Parse error:", e.message);
          logDebug("ERROR_PARSE", { error: e.message, hex: raw.slice(0, 100) });
        }
      }
    });

    this.fromElectron.on("error", (err) => {
      if (retryCount < 40) {
        setTimeout(() => this.connectSend(retryCount + 1), 300);
      } else {
        console.error("[CallDaemon] fromElectron error:", err.message);
      }
    });
  }

  send(obj) {
    logDebug("SEND", obj);
    if (!this.toElectron || this.toElectron.destroyed) {
      this.queue.push(obj);
      return;
    }
    try {
      const json = JSON.stringify(obj);
      const hex = encrypt(json);
      if (hex.length <= 4000) {
        this.toElectron.write(hex + "$");
      } else {
        const parts = hex.match(/.{1,4000}/g);
        const id = Date.now();
        parts.forEach((part, i) => {
          this.toElectron.write(`${part}#${id}#${parts.length}#${i}#$`);
        });
      }
    } catch (e) {
      console.error("[CallDaemon] Send error:", e.message);
    }
  }

  handleMessage(msg) {
    console.log("[CallDaemon] Received message:", msg.type, msg.command);

    if (msg.type === "update" && msg.command === "init") {
      if (msg.data && msg.data.local) {
        this.localUser = msg.data.local;
      }
      this.send({
        type: "response",
        command: "listDevice",
        data: DEFAULT_DEVICES
      });
    }

    if (msg.type === "request" && msg.command === "listDevice") {
      this.send({
        type: "response",
        command: "listDevice",
        data: DEFAULT_DEVICES
      });
      return;
    }

    if (this.engine) {
      try {
        this.engine.onZaloFrame(msg);
      } catch (e) {
        logDebug("ENGINE_ERROR", { error: e.message, stack: e.stack });
      }
    }
  }

  openCallWindow(partner, initialStatus, isIncoming = false, isVideoCall = false) {
    if (!electron || !electron.BrowserWindow) return;

    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.focus();
      return;
    }

    const isVideo = !!isVideoCall;
    this.callWindow = new electron.BrowserWindow({
      width: isVideo ? 780 : 380,
      height: isVideo ? 600 : 580,
      minWidth: 360,
      minHeight: 520,
      resizable: true,
      autoHideMenuBar: true,
      title: isIncoming ? (isVideo ? "Cuộc gọi video đến - Zalo" : "Cuộc gọi đến - Zalo") : (isVideo ? "Zalo Video Call" : "Zalo Call"),
      frame: true,
      alwaysOnTop: isIncoming,
      backgroundColor: "#0d1117",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    try {
      this.callWindow.setMenu(null);
      this.callWindow.setMenuBarVisibility(false);
    } catch (e) {}

    if (this.callWindow.webContents && this.callWindow.webContents.session) {
      try {
        const ses = this.callWindow.webContents.session;
        ses.setPermissionCheckHandler(() => true);
        ses.setPermissionRequestHandler((wc, perm, cb) => cb(true));
        ses.setDevicePermissionHandler(() => true);
        if (typeof ses.setDisplayMediaRequestHandler === "function") {
          ses.setDisplayMediaRequestHandler(async (request, callback) => {
            try {
              if (electron.desktopCapturer) {
                const sources = await electron.desktopCapturer.getSources({ types: ["screen", "window"] });
                const screenSource = sources.find(s => s.id.startsWith("screen:")) || sources[0];
                callback({ video: screenSource });
                return;
              }
            } catch (e) {}
            callback({});
          });
        }
      } catch (e) {}
    }

    const CALL_WINDOW_HTML = path.join(__dirname, "call_window.html");
    const partnerAvatar = (partner && partner.avatar) ? partner.avatar : "https://s160-ava-talk.zadn.vn/default";
    const partnerName = (partner && partner.name) ? partner.name : "Người dùng Zalo";

    this.callWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      logDebug("RENDERER", `[L${level}] ${message} (${sourceId}:${line})`);
    });

    this.callWindow.loadFile(CALL_WINDOW_HTML, {
      query: {
        name: partnerName,
        avatar: partnerAvatar,
        status: initialStatus || "Đang gọi...",
        incoming: isIncoming ? "1" : "0",
        video: isVideo ? "1" : "0"
      }
    });

    this.callWindow.webContents.on('did-finish-load', () => {
      if (this.callWindow && !this.callWindow.isDestroyed()) {
        this.callWindow.webContents.send('init-call-data', {
          partner,
          initialStatus,
          isIncoming: !!isIncoming,
          isVideoCall: !!isVideo
        });
      }
    });

    this.callWindow.on("closed", () => {
      this.callWindow = null;
      if (this.hangupCb) {
        this.hangupCb();
      }
    });
  }

  updateCallWindowConnected() {
    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.webContents.send('call-connected');
    }
  }

  updateCallWindowStatus(status) {
    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.webContents.send('call-status', status);
    }
  }
}

// Entrypoint
const nonFlagArgs = process.argv.slice(1).filter(arg => !arg.startsWith("--") && !arg.endsWith(".js"));
const recvSocket = nonFlagArgs[0] || "/tmp/socketzalorecv2021";
const sendSocket = nonFlagArgs[1] || "/tmp/socketzalosend2021";

if (electron && electron.app) {
  electron.app.on("window-all-closed", (e) => {
    e.preventDefault(); // Keep daemon alive to receive future calls
  });
  electron.app.whenReady().then(() => {
    const daemon = new ZaloCallDaemon(recvSocket, sendSocket);
    daemon.start();
  });
} else {
  const daemon = new ZaloCallDaemon(recvSocket, sendSocket);
  daemon.start();
}
