/**
 * Native Linux Call Daemon for Zalo PC
 * Emulates ZaloCall native engine over Unix domain sockets.
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

      // Set callState incall
      this.send({
        type: "update",
        command: "callState",
        data: { state: "incall" }
      });

      // Send 401 signal to ask Zalo server for call endpoints
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

      // Show call UI window
      this.openCallWindow(partner, "Đang gọi...");
      return;
    }

    if (msg.type === "recvSignal" && msg.command === 401) {
      const res = msg.data || {};
      if (this.currentCall) {
        const rtcpAddr = res.rtcpAddress || (res.servers && res.servers[0] ? res.servers[0].rtcpaddr : "");
        const rtpAddr = res.rtpAddress || (res.servers && res.servers[0] ? res.servers[0].rtpaddr : "");
        const session = res.session || res.sessId || "";

        // Send 416 request
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
      if (ctrl.act === "request" && ctrl.act_type === "voip") {
        const callData = ctrl.data || {};
        this.currentCall = {
          callId: callData.callId,
          calleeId: callData.callerId,
          partner: {
            id: callData.callerId,
            name: callData.name || "Cuộc gọi đến",
            avatar: callData.avatar || ""
          },
          type: callData.callType || 3,
          isCaller: false
        };

        this.openIncomingCallWindow(this.currentCall.partner);
      } else if (ctrl.act === "answer") {
        this.updateCallWindowStatus("Đã kết nối");
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

  openCallWindow(partner, initialStatus) {
    if (!electron || !electron.BrowserWindow) return;

    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.focus();
      return;
    }

    this.callWindow = new electron.BrowserWindow({
      width: 360,
      height: 540,
      resizable: false,
      title: "Zalo Call",
      frame: true,
      backgroundColor: "#161b22",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

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
        .header { text-align: center; margin-top: 20px; }
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
        .actions { display: flex; gap: 24px; align-items: center; margin-bottom: 20px; }
        .btn {
          width: 56px;
          height: 56px;
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
        .btn-end { background: #ea3943; color: #fff; width: 64px; height: 64px; }
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

      <div class="actions">
        <button class="btn btn-mute" id="muteBtn" title="Bật/Tắt Micro">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        <button class="btn btn-end" id="endBtn" title="Kết thúc">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.28 8.78 7.39 7 12 7c4.61 0 8.72 1.78 11.71 4.67.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29s-.52-.11-.7-.28c-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
          </svg>
        </button>
      </div>

      <script>
        const { ipcRenderer } = require('electron');
        const endBtn = document.getElementById('endBtn');
        const muteBtn = document.getElementById('muteBtn');
        const statusEl = document.getElementById('callStatus');
        const timerEl = document.getElementById('callTimer');

        let isMuted = false;
        let timerInterval = null;
        let seconds = 0;

        muteBtn.addEventListener('click', () => {
          isMuted = !isMuted;
          muteBtn.classList.toggle('active', isMuted);
        });

        endBtn.addEventListener('click', () => {
          window.close();
        });

        window.addEventListener('message', (e) => {
          if (e.data && e.data.status) {
            statusEl.innerText = e.data.status;
            if (e.data.status === 'Đã kết nối') {
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

  updateCallWindowStatus(status) {
    if (this.callWindow && !this.callWindow.isDestroyed()) {
      this.callWindow.webContents.executeJavaScript(`
        window.postMessage({ status: ${JSON.stringify(status)} }, '*');
      `);
    }
  }

  openIncomingCallWindow(partner) {
    this.openCallWindow(partner, "Cuộc gọi đến...");
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

