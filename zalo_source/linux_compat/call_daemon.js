/**
 * Native Linux Call Daemon for Zalo PC
 * Emulates ZaloCall native engine over Unix domain sockets with full Incoming & Outgoing Call UI.
 */

const net = require("net");
const crypto = require("crypto");
const path = require("path");
let electron = null;
try {
  electron = require("electron");
} catch (e) {}

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
    this.queue = [];
    this.currentCall = null;
    this.callWindow = null;
    this.localUser = null;
    this.setupIpcMain();
  }

  setupIpcMain() {
    if (!electron || !electron.ipcMain) return;

    electron.ipcMain.on("call-action-answer", () => {
      this.answerIncomingCall();
    });

    electron.ipcMain.on("call-action-decline", () => {
      this.declineIncomingCall();
    });

    electron.ipcMain.on("call-action-end", () => {
      this.endCall(true);
    });
  }

  start() {
    console.log("[CallDaemon] Starting with sockets:", this.recvPath, this.sendPath);
    this.connectRecv();
    this.connectSend();
  }

  connectRecv(retryCount = 0) {
    this.toElectron = net.createConnection(this.recvPath, () => {
      console.log("[CallDaemon] Connected to Electron serverRecv");
      this.send({ type: "update", command: "native-ready" });
      while (this.queue.length > 0) {
        this.send(this.queue.shift());
      }
    });

    this.toElectron.on("error", (err) => {
      if (retryCount < 20) {
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
      for (const hex of parts) {
        if (!hex) continue;
        try {
          const jsonStr = decrypt(hex).replace(/[\0]/g, "");
          const msg = JSON.parse(jsonStr);
          this.handleMessage(msg);
        } catch (e) {
          console.error("[CallDaemon] Decrypt/Parse error:", e.message);
        }
      }
    });

    this.fromElectron.on("error", (err) => {
      if (retryCount < 20) {
        setTimeout(() => this.connectSend(retryCount + 1), 300);
      } else {
        console.error("[CallDaemon] fromElectron error:", err.message);
      }
    });
  }

  send(obj) {
    if (!this.toElectron || this.toElectron.destroyed) {
      this.queue.push(obj);
      return;
    }
    try {
      const json = JSON.stringify(obj);
      const enc = encrypt(json) + "$";
      this.toElectron.write(enc);
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
      return;
    }

    if (msg.type === "request" && msg.command === "listDevice") {
      this.send({
        type: "response",
        command: "listDevice",
        data: DEFAULT_DEVICES
      });
      return;
    }

    if (msg.type === "request" && msg.command === "makeCall") {
      const data = msg.data || {};
      const partner = data.partner && data.partner[0] ? data.partner[0] : { name: "Người dùng", id: "0" };
      const callType = data.type || 3;
      const callId = Math.floor(Date.now() / 1000);

      this.currentCall = {
        callId,
        calleeId: partner.id,
        partner,
        type: callType,
        isCaller: true,
        startTime: Date.now()
      };

      this.send({
        type: "update",
        command: "callState",
        data: { state: "incall" }
      });

      this.send({
        type: "sendSignal",
        command: 401,
        data: {
          calleeId: partner.id,
          callId: callId,
          codec: 1,
          type: callType
        }
      });

      this.openCallWindow(partner, "Đang gọi...", false);
      return;
    }

    if (msg.type === "recvSignal" && msg.command === 401) {
      const res = msg.data || {};
      if (this.currentCall) {
        const rtcpAddr = res.rtcpAddress || (res.servers && res.servers[0] ? res.servers[0].rtcpaddr : "");
        const rtpAddr = res.rtpAddress || (res.servers && res.servers[0] ? res.servers[0].rtpaddr : "");
        const session = res.session || res.sessId || "";

        this.send({
          type: "sendSignal",
          command: 416,
          data: {
            calleeId: this.currentCall.calleeId,
            rtcpAddress: rtcpAddr,
            rtpAddress: rtpAddr,
            codec: 1,
            extendData: "",
            session: session,
            callId: this.currentCall.callId
          }
        });

        this.updateCallWindowStatus("Đang đổ chuông...");
      }
      return;
    }

    if (msg.type === "control") {
      const ctrl = msg.data || {};
      if ((ctrl.act === "request" || ctrl.act === "group_request") && ctrl.act_type === "voip") {
        const callData = ctrl.data || {};
        const callerId = callData.callerId || callData.uidN || "0";
        const callId = callData.callId || Math.floor(Date.now() / 1000);

        this.currentCall = {
          callId: callId,
          calleeId: callerId,
          callerId: callerId,
          partner: {
            id: callerId,
            name: callData.name || callData.dName || "Cuộc gọi đến",
            avatar: callData.avatar || ""
          },
          type: callData.callType || 3,
          isCaller: false,
          rtcpAddress: callData.rtcpAddress || "",
          rtpAddress: callData.rtpAddress || "",
          session: callData.session || callData.sessId || ""
        };

        this.openCallWindow(this.currentCall.partner, "Cuộc gọi đến...", true);
      } else if (ctrl.act === "answer") {
        this.updateCallWindowConnected();
      } else if (ctrl.act === "cancel" || ctrl.act === "end") {
        this.endCall(false);
      }
      return;
    }

    if (msg.type === "request" && (msg.command === "endCall" || msg.command === "cancelCall")) {
      this.endCall(true);
      return;
    }
  }

  answerIncomingCall() {
    if (!this.currentCall) return;

    // Send 402 answer call signal to Zalo backend
    this.send({
      type: "sendSignal",
      command: 402,
      data: {
        callerId: this.currentCall.calleeId,
        callId: this.currentCall.callId,
        status: 0,
        codec: 1,
        extendData: "",
        rtcpAddress: this.currentCall.rtcpAddress || "",
        rtpAddress: this.currentCall.rtpAddress || "",
        session: this.currentCall.session || ""
      }
    });

    // Send 408 answer ACK
    this.send({
      type: "sendSignal",
      command: 408,
      data: {
        calleeId: this.currentCall.calleeId,
        callId: this.currentCall.callId
      }
    });

    // Update state to in-call
    this.send({
      type: "update",
      command: "callState",
      data: { state: "incall" }
    });

    this.updateCallWindowConnected();
  }

  declineIncomingCall() {
    if (!this.currentCall) return;

    this.send({
      type: "sendSignal",
      command: 405,
      data: {
        toId: this.currentCall.calleeId,
        callId: this.currentCall.callId,
        callType: this.currentCall.type || 3
      }
    });

    this.send({
      type: "update",
      command: "callState",
      data: { state: "free" }
    });

    this.currentCall = null;
    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.close();
      this.callWindow = null;
    }
  }

  endCall(notifyElectron = true) {
    if (this.currentCall && notifyElectron) {
      this.send({
        type: "sendSignal",
        command: 409,
        data: {
          toId: this.currentCall.calleeId,
          callId: this.currentCall.callId
        }
      });
    }

    this.send({
      type: "update",
      command: "callState",
      data: { state: "free" }
    });

    this.currentCall = null;
    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.close();
      this.callWindow = null;
    }
  }

  openCallWindow(partner, initialStatus, isIncoming = false) {
    if (!electron || !electron.BrowserWindow) return;

    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.focus();
      return;
    }

    this.callWindow = new electron.BrowserWindow({
      width: 360,
      height: 560,
      resizable: false,
      title: isIncoming ? "Cuộc gọi đến - Zalo" : "Zalo Call",
      frame: true,
      alwaysOnTop: isIncoming,
      backgroundColor: "#161b22",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const isIncomingFlag = !!isIncoming;
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(180deg, #182234 0%, #0d1117 100%);
          color: #fff;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 40px 20px;
        }
        .header { text-align: center; margin-top: 20px; width: 100%; }
        .avatar-wrap {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          border: 3px solid rgba(0, 104, 255, 0.6);
          padding: 3px;
          margin: 0 auto 16px;
          box-shadow: 0 0 20px rgba(0, 104, 255, 0.4);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 104, 255, 0.6); }
          70% { box-shadow: 0 0 0 16px rgba(0, 104, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 104, 255, 0); }
        }
        .avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          background: #30363d;
        }
        .name { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .status { font-size: 14px; color: #8b949e; }
        .timer { font-size: 16px; font-weight: 500; color: #58a6ff; margin-top: 8px; display: none; }
        
        .actions { display: flex; gap: 32px; align-items: center; margin-bottom: 24px; }
        .btn-action-col { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .btn-label { font-size: 12px; color: #8b949e; }
        
        .btn {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          border: none;
          outline: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s, background-color 0.15s;
        }
        .btn:hover { transform: scale(1.08); }
        .btn:active { transform: scale(0.95); }
        .btn-mute { background: rgba(255, 255, 255, 0.15); color: #fff; }
        .btn-mute.active { background: #f85149; }
        .btn-end { background: #ea3943; color: #fff; width: 62px; height: 62px; }
        .btn-answer { background: #2da44e; color: #fff; width: 64px; height: 64px; box-shadow: 0 0 16px rgba(46, 160, 67, 0.6); }

        #incomingActions { display: ${isIncomingFlag ? 'flex' : 'none'}; gap: 40px; }
        #activeActions { display: ${isIncomingFlag ? 'none' : 'flex'}; gap: 28px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="avatar-wrap">
          <img class="avatar" src="${partner.avatar || 'https://s160-ava-talk.zadn.vn/default'}" onerror="this.src='https://s160-ava-talk.zadn.vn/default'" />
        </div>
        <div class="name">${partner.name || 'Người dùng Zalo'}</div>
        <div class="status" id="callStatus">${initialStatus}</div>
        <div class="timer" id="callTimer">00:00</div>
      </div>

      <!-- INCOMING CALL BUTTONS -->
      <div class="actions" id="incomingActions">
        <div class="btn-action-col">
          <button class="btn btn-end" id="declineBtn" title="Từ chối">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.28 8.78 7.39 7 12 7c4.61 0 8.72 1.78 11.71 4.67.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29s-.52-.11-.7-.28c-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
          <span class="btn-label">Từ chối</span>
        </div>
        <div class="btn-action-col">
          <button class="btn btn-answer" id="answerBtn" title="Bắt máy">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.053 15.053 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1.01A11.36 11.36 0 0 1 8.5 3.99c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
            </svg>
          </button>
          <span class="btn-label" style="color: #3fb950; font-weight: 500;">Bắt máy</span>
        </div>
      </div>

      <!-- ACTIVE / OUTGOING CALL BUTTONS -->
      <div class="actions" id="activeActions">
        <div class="btn-action-col">
          <button class="btn btn-mute" id="muteBtn" title="Bật/Tắt Micro">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
          <span class="btn-label">Tắt mic</span>
        </div>
        <div class="btn-action-col">
          <button class="btn btn-end" id="endBtn" title="Kết thúc">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.28 8.78 7.39 7 12 7c4.61 0 8.72 1.78 11.71 4.67.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29s-.52-.11-.7-.28c-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
          <span class="btn-label">Kết thúc</span>
        </div>
      </div>

      <script>
        const { ipcRenderer } = require('electron');
        const endBtn = document.getElementById('endBtn');
        const answerBtn = document.getElementById('answerBtn');
        const declineBtn = document.getElementById('declineBtn');
        const muteBtn = document.getElementById('muteBtn');
        const statusEl = document.getElementById('callStatus');
        const timerEl = document.getElementById('callTimer');
        const incomingActions = document.getElementById('incomingActions');
        const activeActions = document.getElementById('activeActions');

        let isMuted = false;
        let timerInterval = null;
        let ringInterval = null;
        let audioCtx = null;
        let seconds = 0;

        function playRingtone() {
          try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            function ring() {
              if (!audioCtx) return;
              const osc1 = audioCtx.createOscillator();
              const osc2 = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc1.frequency.value = 440;
              osc2.frequency.value = 480;
              gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.6);
              osc1.connect(gain);
              osc2.connect(gain);
              gain.connect(audioCtx.destination);
              osc1.start();
              osc2.start();
              osc1.stop(audioCtx.currentTime + 1.6);
              osc2.stop(audioCtx.currentTime + 1.6);
            }
            ring();
            ringInterval = setInterval(ring, 3000);
          } catch (e) {}
        }

        function stopRingtone() {
          if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
          if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
        }

        if (${isIncomingFlag}) {
          playRingtone();
        }

        answerBtn.addEventListener('click', () => {
          stopRingtone();
          incomingActions.style.display = 'none';
          activeActions.style.display = 'flex';
          statusEl.innerText = 'Đã kết nối';
          startTimer();
          ipcRenderer.send('call-action-answer');
        });

        declineBtn.addEventListener('click', () => {
          stopRingtone();
          ipcRenderer.send('call-action-decline');
        });

        endBtn.addEventListener('click', () => {
          stopRingtone();
          ipcRenderer.send('call-action-end');
        });

        muteBtn.addEventListener('click', () => {
          isMuted = !isMuted;
          muteBtn.classList.toggle('active', isMuted);
        });

        function startTimer() {
          timerEl.style.display = 'block';
          if (!timerInterval) {
            timerInterval = setInterval(() => {
              seconds++;
              const m = String(Math.floor(seconds / 60)).padStart(2, '0');
              const s = String(seconds % 60).padStart(2, '0');
              timerEl.innerText = m + ':' + s;
            }, 1000);
          }
        }

        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'connected') {
            stopRingtone();
            incomingActions.style.display = 'none';
            activeActions.style.display = 'flex';
            statusEl.innerText = 'Đã kết nối';
            startTimer();
          } else if (e.data && e.data.status) {
            statusEl.innerText = e.data.status;
          }
        });
      </script>
    </body>
    </html>
    `;

    this.callWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    this.callWindow.on("closed", () => {
      this.callWindow = null;
      this.endCall(true);
    });
  }

  updateCallWindowConnected() {
    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.webContents.executeJavaScript(`
        window.postMessage({ type: 'connected' }, '*');
      `);
    }
  }

  updateCallWindowStatus(status) {
    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.webContents.executeJavaScript(`
        window.postMessage({ status: ${JSON.stringify(status)} }, '*');
      `);
    }
  }
}

// Entrypoint
const nonFlagArgs = process.argv.slice(1).filter(arg => !arg.startsWith("--") && !arg.endsWith(".js"));
const recvSocket = nonFlagArgs[0] || "/tmp/socketzalorecv2021";
const sendSocket = nonFlagArgs[1] || "/tmp/socketzalosend2021";

if (electron && electron.app) {
  electron.app.whenReady().then(() => {
    const daemon = new ZaloCallDaemon(recvSocket, sendSocket);
    daemon.start();
  });
} else {
  const daemon = new ZaloCallDaemon(recvSocket, sendSocket);
  daemon.start();
}
